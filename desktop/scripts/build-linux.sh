#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROOT_DIR="$(cd "${DESKTOP_DIR}/.." && pwd)"
RELEASE_DIR="${ROOT_DIR}/release"
STAGE_BASE="${ROOT_DIR}/release-stage"
UNPACKED_DIR="${RELEASE_DIR}/linux-unpacked"
PRISTINE_DIR="${STAGE_BASE}/pristine-unpacked"
VERSION="$(node -p "require('${DESKTOP_DIR}/package.json').version")"
RPM_VERSION="${VERSION//-/.}"

cleanup() {
  rm -rf "${STAGE_BASE}" "${RELEASE_DIR}"/__* "${RELEASE_DIR}"/.icon-* 2>/dev/null || true
}
trap cleanup EXIT

verify_unpacked_dir() {
  local dir="$1"
  local required_files=(
    "nimchesko-ai-studio"
    "resources/app.asar"
    "LICENSE.electron.txt"
    "LICENSES.chromium.html"
    "chrome-sandbox"
  )

  if [[ ! -x "${dir}/nimchesko-ai-studio" ]]; then
    echo "Error: Binary is missing or not executable: ${dir}/nimchesko-ai-studio" >&2
    ls -la "${dir}" || true
    exit 1
  fi

  for rel_path in "${required_files[@]}"; do
    if [[ ! -f "${dir}/${rel_path}" ]]; then
      echo "Error: Missing expected Electron file: ${dir}/${rel_path}" >&2
      ls -la "${dir}" || true
      exit 1
    fi
  done

  if [[ ! -d "${dir}/locales" ]] || [[ -z "$(ls -A "${dir}/locales" 2>/dev/null || true)" ]]; then
    echo "Error: Missing or empty locales directory in ${dir}/locales" >&2
    ls -la "${dir}" || true
    exit 1
  fi
}

build_rpm_with_native_rpmbuild() {
  if ! command -v rpmbuild >/dev/null 2>&1; then
    echo "Error: rpmbuild is not installed on this runner." >&2
    exit 1
  fi

  local rpm_stage="${STAGE_BASE}/rpm"
  rm -rf "${rpm_stage}"
  mkdir -p \
    "${rpm_stage}/BUILD" \
    "${rpm_stage}/BUILDROOT" \
    "${rpm_stage}/RPMS" \
    "${rpm_stage}/SOURCES/app-root" \
    "${rpm_stage}/SPECS" \
    "${rpm_stage}/SRPMS"

  local icon_src="${DESKTOP_DIR}/build/icon.png"
  if [[ ! -f "${icon_src}" ]]; then
    icon_src="${ROOT_DIR}/public/pwa-512x512.png"
  fi
  if [[ ! -f "${icon_src}" ]]; then
    echo "Error: Missing Linux icon asset at ${DESKTOP_DIR}/build/icon.png or ${ROOT_DIR}/public/pwa-512x512.png" >&2
    exit 1
  fi

  cp -a --no-preserve=ownership "${PRISTINE_DIR}/." "${rpm_stage}/SOURCES/app-root/"
  cp -f "${icon_src}" "${rpm_stage}/SOURCES/icon.png"
  verify_unpacked_dir "${rpm_stage}/SOURCES/app-root"

  local spec_file="${rpm_stage}/SPECS/nimchesko-ai-studio.spec"
  cat > "${spec_file}" <<EOF
%global debug_package %{nil}
%global _build_id_links none
%global __os_install_post %{nil}
%global _binary_payload w9.gzdio

Name:           nimchesko-ai-studio
Version:        ${RPM_VERSION}
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
install -d -m 0755 "%{buildroot}/opt/nimchesko-ai-studio"
cp -a --no-preserve=ownership "%{_sourcedir}/app-root/." "%{buildroot}/opt/nimchesko-ai-studio/"
chmod 0755 "%{buildroot}/opt/nimchesko-ai-studio/nimchesko-ai-studio"
if [ -f "%{buildroot}/opt/nimchesko-ai-studio/chrome-sandbox" ]; then
  chmod 4755 "%{buildroot}/opt/nimchesko-ai-studio/chrome-sandbox"
fi

test -f "%{buildroot}/opt/nimchesko-ai-studio/nimchesko-ai-studio"
test -f "%{buildroot}/opt/nimchesko-ai-studio/resources/app.asar"
test -f "%{buildroot}/opt/nimchesko-ai-studio/LICENSE.electron.txt"
test -d "%{buildroot}/opt/nimchesko-ai-studio/locales"

install -d -m 0755 "%{buildroot}/usr/bin"
ln -sf /opt/nimchesko-ai-studio/nimchesko-ai-studio "%{buildroot}/usr/bin/nimchesko-ai-studio"

install -d -m 0755 "%{buildroot}/usr/share/applications"
cat > "%{buildroot}/usr/share/applications/nimchesko-ai-studio.desktop" <<'DESKTOP_EOF'
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
chmod 0644 "%{buildroot}/usr/share/applications/nimchesko-ai-studio.desktop"

install -d -m 0755 "%{buildroot}/usr/share/icons/hicolor/512x512/apps"
install -m 0644 "%{_sourcedir}/icon.png" "%{buildroot}/usr/share/icons/hicolor/512x512/apps/nimchesko-ai-studio.png"

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
    --define "_rpmdir ${rpm_stage}/RPMS" \
    "${spec_file}"

  local built_rpm
  built_rpm="$(find "${rpm_stage}/RPMS" -type f -name "*.rpm" | head -n 1 || true)"
  if [[ -z "${built_rpm}" || ! -f "${built_rpm}" ]]; then
    echo "Error: native rpmbuild did not produce an .rpm archive." >&2
    exit 1
  fi

  local dest_rpm="${RELEASE_DIR}/nimchesko-ai-studio-${VERSION}-x86_64.rpm"
  cp -f "${built_rpm}" "${dest_rpm}"

  if command -v rpm >/dev/null 2>&1; then
    echo "==> Verifying .rpm package contents:"
    rpm -qpi "${dest_rpm}"
    rpm -qlp "${dest_rpm}" | grep -E '(nimchesko-ai-studio|app\.asar|chrome-sandbox|LICENSE\.electron\.txt|\.desktop|icon\.png|locales/en-US\.pak)$' || true
  fi
}

cd "${DESKTOP_DIR}"

echo "==> Cleaning previous release, build, and stage directories..."
rm -rf "${RELEASE_DIR}" "${DESKTOP_DIR}/dist" "${DESKTOP_DIR}/build" "${DESKTOP_DIR}/node_modules/.cache" "${STAGE_BASE}"
mkdir -p "${RELEASE_DIR}" "${STAGE_BASE}"
npm run prepare:icons

echo "==> Step 1/5: Unpacking Electron Linux directory (dir target)..."
npx electron-builder --linux dir --x64 --publish never --config electron-builder.yml
verify_unpacked_dir "${UNPACKED_DIR}"

echo "==> Verified unpacked app contents:"
find "${UNPACKED_DIR}" -maxdepth 2 -type f | head -n 25
ls -lh "${UNPACKED_DIR}"
ls -lh "${UNPACKED_DIR}/resources"

mkdir -p "${PRISTINE_DIR}"
cp -a "${UNPACKED_DIR}/." "${PRISTINE_DIR}/"

echo "==> Step 2/5: Building .tar, .tar.zst, and Arch .pkg.tar.zst archives..."
bash "${SCRIPT_DIR}/build-extra-linux-archives.sh"

echo "==> Step 3/5: Building AppImage in isolated stage directory..."
APPIMAGE_IN="${STAGE_BASE}/appimage-in"
APPIMAGE_OUT="${STAGE_BASE}/appimage-out"
mkdir -p "${APPIMAGE_IN}" "${APPIMAGE_OUT}"
cp -a "${PRISTINE_DIR}/." "${APPIMAGE_IN}/"
npx electron-builder --linux AppImage --x64 \
  --prepackaged "${APPIMAGE_IN}" \
  --publish never \
  --config electron-builder.yml \
  --config.directories.output="${APPIMAGE_OUT}"
BUILT_APPIMAGE="$(find "${APPIMAGE_OUT}" -maxdepth 2 -type f -name "*.AppImage" | head -n 1 || true)"
if [[ -z "${BUILT_APPIMAGE}" || ! -f "${BUILT_APPIMAGE}" ]]; then
  echo "Error: AppImage was not created in ${APPIMAGE_OUT}" >&2
  ls -la "${APPIMAGE_OUT}" || true
  exit 1
fi
cp -f "${BUILT_APPIMAGE}" "${RELEASE_DIR}/"

echo "==> Step 4/5: Building .deb in isolated stage directory..."
DEB_IN="${STAGE_BASE}/deb-in"
DEB_OUT="${STAGE_BASE}/deb-out"
mkdir -p "${DEB_IN}" "${DEB_OUT}"
cp -a "${PRISTINE_DIR}/." "${DEB_IN}/"
npx electron-builder --linux deb --x64 \
  --prepackaged "${DEB_IN}" \
  --publish never \
  --config electron-builder.yml \
  --config.directories.output="${DEB_OUT}"
BUILT_DEB="$(find "${DEB_OUT}" -maxdepth 2 -type f -name "*.deb" | head -n 1 || true)"
if [[ -z "${BUILT_DEB}" || ! -f "${BUILT_DEB}" ]]; then
  echo "Error: .deb package was not created in ${DEB_OUT}" >&2
  ls -la "${DEB_OUT}" || true
  exit 1
fi
cp -f "${BUILT_DEB}" "${RELEASE_DIR}/"

echo "==> Step 5/5: Building .rpm in isolated stage directory with native rpmbuild..."
build_rpm_with_native_rpmbuild

for pattern in "*.deb" "*.rpm" "*.AppImage" "*.tar" "*.tar.zst" "*.pkg.tar.zst"; do
  matched="$(compgen -G "${RELEASE_DIR}/${pattern}" | head -n 1 || true)"
  if [[ -z "${matched}" || ! -s "${matched}" ]]; then
    echo "Error: Expected non-empty Linux release artifact matching ${pattern} was not created." >&2
    exit 1
  fi
done

echo "==> All Linux release packages verified in ${RELEASE_DIR}:"
ls -lh "${RELEASE_DIR}"
