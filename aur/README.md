# Arch User Repository (AUR) Package for Proxy Press

This directory contains the packaging files for [`proxypress-bin`](https://aur.archlinux.org/packages/proxypress-bin) on the Arch User Repository.

## Installing with `makepkg`

Download `proxypress-bin-aur.tar.gz` from GitHub Releases, extract, and build:

```sh
tar -xvf proxypress-bin-aur.tar.gz
makepkg -si
```

Once submitted to `aur.archlinux.org`, installation will also be possible via AUR helpers:
```sh
yay -S proxypress-bin
# or
paru -S proxypress-bin
```

## Publishing / Updating the AUR repository

To push updates to `aur.archlinux.org`:
```sh
git clone ssh://aur@aur.archlinux.org/proxypress-bin.git
cp aur/PKGBUILD aur/.SRCINFO proxypress-bin/
cd proxypress-bin
git add PKGBUILD .SRCINFO
git commit -m "Update to v1.0.0"
git push
```
