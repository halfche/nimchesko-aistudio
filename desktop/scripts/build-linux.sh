#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROOT_DIR="$(cd "${DESKTOP_DIR}/.." && pwd)"
RELEASE_DIR="${ROOT_DIR}/release"
UNPACKED_DIR="${RELEASE_DIR}/linux-unpacked"
VERSION="$(node -p "require('${DESKTOP_DIR}/package.json').version")"

clean_staging() {
  rm -rf "${RELEASE_DIR}"/__* "${RELEASE_DIR}"/.icon-* 2>/dev/null || true
}

build_rpm_with_native_rpmbuild() {
  local rpm_stage
  rpm_stage="$(mktemp -d)"

  mkdir -p "${rpm_stage}/BUILD" "${rpm_stage}/RPMS" "${rpm_stage}/SOURCES" "${rpm_stage}/SPECS" "${rpm_stage}/SRPMS" "${rpm_stage}/BUILDROOT"

  local icon_src="${DESKTOP_DIR}/build/icon.png"
  if [[ ! -f "${icon_src}" ]]; then
    icon_src="${ROOT_DIR}/public/pwa-512x512.png"
  fi

  local spec_file="${rpm_stage}/SPECS/nimchesko-ai-studio.spec"
  cat > "${spec_file}" <<EOF
%global debug_package %{nil}
%global _build_id_links none
%global __os_install_post %{nil}

Name:           nimchesko-ai-studio
Version:        ${VERSION}
Release:        1
Summary:        nimchesko AI studio - Local AI workspace for all local models
License:        MIT
URL:            https://github.com/halfche/nimchesko-aistudio
BuildArch:      x86_64
AutoReqProv:    no
Requires:       gtk3
Requires:       libnotify
Requires:       nss
Requires:       libXScrnSaver
Requires:       libXtst
Requires:       xdg-utils
Requires:       at-spi2-core
Requires:       libuuid

%description
Cross-platform local AI studio, multi-model comparison workbench, Hyper Mode,
Journal & Skill Mode, and Ollama/GGUF/safetensors local workspace.

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}/opt/nimchesko-ai-studio
cp -a "${UNPACKED_DIR}/." "%{buildroot}/opt/nimchesko-ai-studio/"
chmod 755 "%{buildroot}/opt/nimchesko-ai-studio/nimchesko-ai-studio"
if [ -f "%{buildroot}/opt/nimchesko-ai-studio/chrome-sandbox" ]; then
  chmod 4755 "%{buildroot}/opt/nimchesko-ai-studio/chrome-sandbox"
fi
mkdir -p %{buildroot}/usr/bin
ln -sf /opt/nimchesko-ai-studio/nimchesko-ai-studio %{buildroot}/usr/bin/nimchesko-ai-studio

mkdir -p %{buildroot}/usr/share/applications
cat > %{buildroot}/usr/share/applications/nimchesko-ai-studio.desktop <<'DESKTOP_EOF'
[Desktop Entry]
Name=nimchesko AI studio
Comment=Cross-platform local AI workspace for all local models
Exec=/usr/bin/nimchesko-ai-studio %U
Icon=nimchesko-ai-studio
Terminal=false
Type=Application
Categories=Development;Utility;
StartupWMClass=nimchesko-ai-studio
DESKTOP_EOF

mkdir -p %{buildroot}/usr/share/icons/hicolor/512x512/apps
cp "${icon_src}" "%{buildroot}/usr/share/icons/hicolor/512x512/apps/nimchesko-ai-studio.png"

%files
%defattr(-,root,root,-)
/opt/nimchesko-ai-studio
/usr/bin/nimchesko-ai-studio
/usr/share/applications/nimchesko-ai-studio.desktop
/usr/share/icons/hicolor/512x512/apps/nimchesko-ai-studio.png
EOF

  echo "==> Building .rpm via native rpmbuild (${spec_file})..."
  rpmbuild -bb \
    --target x86_64 \
    --define "_topdir ${rpm_stage}" \
    "${spec_file}"

  local built_rpm
  built_rpm="$(find "${rpm_stage}/RPMS" -type f -name "*.rpm" | head -n 1 || true)"
  if [[ -z "${built_rpm}" || ! -f "${built_rpm}" ]]; then
    echo "Error: native rpmbuild did not produce an .rpm archive." >&2
    rm -rf "${rpm_stage}"
    return 1
  fi

  local dest_rpm="${RELEASE_DIR}/nimchesko-ai-studio-${VERSION}-x86_64.rpm"
  cp -f "${built_rpm}" "${dest_rpm}"
  rm -rf "${rpm_stage}"
  echo "==> Native rpmbuild succeeded: ${dest_rpm}"
}

cd "${DESKTOP_DIR}"

echo "==> Cleaning previous release staging..."
rm -rf "${RELEASE_DIR}"
npm run prepare:icons

echo "==> Step 1/5: Unpacking Electron Linux directory (dir target)..."
npx electron-builder --linux dir --x64 --publish never --config electron-builder.yml

if [[ ! -f "${UNPACKED_DIR}/nimchesko-ai-studio" ]]; then
  echo "Error: Missing unpacked binary at ${UNPACKED_DIR}/nimchesko-ai-studio" >&2
  ls -la "${UNPACKED_DIR}" || true
  exit 1
fi
if [[ ! -f "${UNPACKED_DIR}/resources/app.asar" ]]; then
  echo "Error: Missing resources/app.asar at ${UNPACKED_DIR}/resources/app.asar" >&2
  ls -la "${UNPACKED_DIR}/resources" || true
  exit 1
fi

echo "==> Verified unpacked app contents:"
ls -lh "${UNPACKED_DIR}"
ls -lh "${UNPACKED_DIR}/resources"

echo "==> Step 2/5: Building AppImage sequentially..."
clean_staging
npx electron-builder --linux AppImage --x64 --prepackaged "${UNPACKED_DIR}" --publish never --config electron-builder.yml

echo "==> Step 3/5: Building .deb sequentially..."
clean_staging
npx electron-builder --linux deb --x64 --prepackaged "${UNPACKED_DIR}" --publish never --config electron-builder.yml

echo "==> Step 4/5: Building .rpm sequentially..."
clean_staging
rm -rf ~/.cache/electron-builder/fpm 2>/dev/null || true
if npx electron-builder --linux rpm --x64 --prepackaged "${UNPACKED_DIR}" --publish never --config electron-builder.yml; then
  echo "==> electron-builder RPM succeeded."
else
  echo "==> electron-builder/fpm RPM failed (common with RPM 4.18+ BUILDROOT on Ubuntu 24.04); switching to native rpmbuild..."
  rm -f "${RELEASE_DIR}"/*.rpm
  clean_staging
  build_rpm_with_native_rpmbuild
fi

if ! compgen -G "${RELEASE_DIR}/*.rpm" >/dev/null; then
  echo "==> No .rpm produced yet; running native rpmbuild..."
  build_rpm_with_native_rpmbuild
fi

rpm_output="$(ls -1 "${RELEASE_DIR}"/*.rpm | head -n 1)"
rpm -qpi "${rpm_output}" || true
rpm -qlp "${rpm_output}" | head -n 25 || true

echo "==> Step 5/5: Building .tar, .tar.zst, and Arch .pkg.tar.zst archives..."
bash "${SCRIPT_DIR}/build-extra-linux-archives.sh"

for pattern in "*.deb" "*.rpm" "*.AppImage" "*.tar" "*.tar.zst" "*.pkg.tar.zst"; do
  if ! compgen -G "${RELEASE_DIR}/${pattern}" >/dev/null; then
    echo "Error: Expected Linux release artifact matching ${pattern} was not created." >&2
    exit 1
  fi
done

echo "==> All Linux release packages verified in ${RELEASE_DIR}:"
ls -lh "${RELEASE_DIR}"
