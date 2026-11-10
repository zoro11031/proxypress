# Arch User Repository (AUR) Package for Proxy Press

This directory contains the packaging files for [`proxypress-bin`](https://aur.archlinux.org/packages/proxypress-bin) on the Arch User Repository.

## Installing from AUR

If using an AUR helper:
```sh
yay -S proxypress-bin
# or
paru -S proxypress-bin
```

## Installing manually with `makepkg`

```sh
cd aur
makepkg -si
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
