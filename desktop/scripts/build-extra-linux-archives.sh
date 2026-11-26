#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROOT_DIR="$(cd "${DESKTOP_DIR}/.." && pwd)"
RELEASE_DIR="${ROOT_DIR}/release"
UNPACKED_DIR="${RELEASE_DIR}/linux-unpacked"

VERSION="$(node -p "require('${DESKTOP_DIR}/package.json').version")"

if [[ ! -d "${UNPACKED_DIR}" ]]; then
  echo "Error: ${UNPACKED_DIR} does not exist. Run electron-builder linux dir target first." >&2
  exit 1
fi

if ! command -v zstd >/dev/null 2>&1; then
  echo "Error: zstd is required to build .tar.zst and .pkg.tar.zst archives." >&2
  exit 1
fi

# 1. Plain .tar archive
TAR_NAME="nimchesko-ai-studio-${VERSION}-linux-x64.tar"
rm -f "${RELEASE_DIR}/${TAR_NAME}" "${RELEASE_DIR}/${TAR_NAME}.zst"
tar -C "${RELEASE_DIR}" --transform="s|^linux-unpacked|nimchesko-ai-studio-${VERSION}-linux-x64|" -cf "${RELEASE_DIR}/${TAR_NAME}" linux-unpacked

# 2. Compressed .tar.zst (.zst) archive
zstd -19 -k -f -o "${RELEASE_DIR}/${TAR_NAME}.zst" "${RELEASE_DIR}/${TAR_NAME}"

# 3. Arch Linux .pkg.tar.zst package (installable via pacman -U)
PKG_STAGE="$(mktemp -d)"
trap 'rm -rf "${PKG_STAGE}"' EXIT

mkdir -p "${PKG_STAGE}/opt/nimchesko-ai-studio"
cp -a "${UNPACKED_DIR}/." "${PKG_STAGE}/opt/nimchesko-ai-studio/"
chmod 755 "${PKG_STAGE}/opt/nimchesko-ai-studio/nimchesko-ai-studio"

mkdir -p "${PKG_STAGE}/usr/bin"
ln -s /opt/nimchesko-ai-studio/nimchesko-ai-studio "${PKG_STAGE}/usr/bin/nimchesko-ai-studio"

mkdir -p "${PKG_STAGE}/usr/share/applications"
cat > "${PKG_STAGE}/usr/share/applications/nimchesko-ai-studio.desktop" <<'EOF'
[Desktop Entry]
Name=nimchesko AI studio
Comment=Cross-platform local AI workspace for Ollama
Exec=/usr/bin/nimchesko-ai-studio %U
Icon=nimchesko-ai-studio
Terminal=false
Type=Application
Categories=Development;Utility;
StartupWMClass=nimchesko-ai-studio
EOF

mkdir -p "${PKG_STAGE}/usr/share/icons/hicolor/512x512/apps"
cp "${ROOT_DIR}/public/pwa-512x512.png" "${PKG_STAGE}/usr/share/icons/hicolor/512x512/apps/nimchesko-ai-studio.png"

INSTALLED_SIZE="$(du -sb "${PKG_STAGE}" | awk '{print $1}')"
BUILD_DATE="$(date +%s)"

cat > "${PKG_STAGE}/.PKGINFO" <<EOF
pkgname = nimchesko-ai-studio
pkgbase = nimchesko-ai-studio
pkgver = ${VERSION}-1
pkgdesc = nimchesko AI studio — Cross-platform local AI workspace for Ollama
url = https://github.com/halfche/nimchesko-aistudio
builddate = ${BUILD_DATE}
packager = nimchesko CI <nimchesko@gmail.com>
size = ${INSTALLED_SIZE}
arch = x86_64
license = MIT
depend = gtk3
depend = nss
depend = alsa-lib
EOF

PKG_NAME="nimchesko-ai-studio-${VERSION}-1-x86_64.pkg.tar.zst"
(
  cd "${PKG_STAGE}"
  tar --create --format=pax --owner=0 --group=0 --file=- .PKGINFO opt usr | zstd -19 -f -o "${RELEASE_DIR}/${PKG_NAME}"
)

if [[ -f "${ROOT_DIR}/dist/nimchesko-ai-studio-app.zip" ]]; then
  cp "${ROOT_DIR}/dist/nimchesko-ai-studio-app.zip" "${RELEASE_DIR}/nimchesko-ai-studio-app.zip"
fi

ls -lh "${RELEASE_DIR}"
