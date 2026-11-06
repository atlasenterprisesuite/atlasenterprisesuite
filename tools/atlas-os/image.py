#!/usr/bin/env python3
"""Prepare a Debian Live VM image from an allowlist; never installs to host disks."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
FILES = [
    'tools/atlas-os/notes.py', 'tools/atlas-os/notes-bridge.mjs',
    'tools/local-agent/lib/local-core-continuity.mjs',
    'tools/local-agent/lib/local-core-vault.mjs',
]
CONFIG = '''#!/bin/sh
set -eu
lb config noauto \\
  --mode debian --distribution trixie --architectures amd64 \\
  --binary-images iso-hybrid --archive-areas main \\
  --debian-installer false --iso-application "ATLAS OS VM Prototype" \\
  --bootappend-live "boot=live components hostname=atlas-os username=atlas locales=es_US.UTF-8 keyboard-layouts=us" \\
  --mirror-bootstrap https://deb.debian.org/debian \\
  --mirror-chroot https://deb.debian.org/debian \\
  --mirror-binary https://deb.debian.org/debian \\
  "$@"
'''
PACKAGES = '''linux-image-amd64
live-boot
live-config
task-xfce-desktop
python3
python3-tk
nodejs
ca-certificates
network-manager
firefox-esr
'''
DESKTOP = '''[Desktop Entry]
Type=Application
Name=ATLAS Notes — local encrypted vault
Comment=Experimental offline notes; no device synchronization
Exec=/usr/bin/atlas-notes
Icon=accessories-text-editor
Terminal=false
Categories=Office;Utility;
'''


def missing_dependencies():
    return [tool for tool in ['lb', 'debootstrap', 'xorriso', 'mksquashfs'] if not shutil.which(tool)]


def write(base, relative, value, executable=False):
    target = base / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(value)
    target.chmod(0o755 if executable else 0o644)


def prepare(destination):
    # Exclusive mkdir: no overwrite/cleanup of an existing build or user directory.
    destination.mkdir(mode=0o700)
    runtime = destination / 'config/includes.chroot/usr/share/atlas-os'
    digests = {}
    for relative in FILES:
        source = ROOT / relative
        if source.is_symlink() or not source.is_file():
            raise RuntimeError('unsafe_or_missing_source: ' + relative)
        target = runtime / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source.read_bytes())
        target.chmod(0o644)
        digests[relative] = hashlib.sha256(target.read_bytes()).hexdigest()
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    dirty = bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip())
    write(runtime, 'SOURCE.json', json.dumps({'revision': revision, 'dirty': dirty, 'certified': False, 'files': digests}, indent=2) + '\n')
    write(destination, 'auto/config', CONFIG, executable=True)
    write(destination, 'config/package-lists/atlas.list.chroot', PACKAGES)
    write(destination, 'config/includes.chroot/usr/share/applications/atlas-notes.desktop', DESKTOP)
    write(destination, 'config/includes.chroot/usr/bin/atlas-notes',
          '#!/bin/sh\nset -eu\nexec /usr/bin/python3 /usr/share/atlas-os/tools/atlas-os/notes.py\n', executable=True)
    write(destination, 'config/includes.chroot/etc/atlas-os-release',
          'NAME="ATLAS OS"\nVARIANT="Experimental VM live session"\nCERTIFIED=false\n')
    print('Prepared VM-only configuration: ' + str(destination))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare', 'check', 'build'])
    parser.add_argument('directory', nargs='?')
    args = parser.parse_args()
    if args.action == 'check':
        missing = missing_dependencies()
        print(json.dumps({'ready': not missing and os.geteuid() == 0,
                          'missing': missing, 'root_in_isolated_builder_required': os.geteuid() != 0}))
        return 2 if missing or os.geteuid() != 0 else 0
    if not args.directory:
        parser.error('directory required')
    destination = Path(args.directory).absolute()
    if args.action == 'prepare':
        prepare(destination)
        return 0
    missing = missing_dependencies()
    if missing or os.geteuid() != 0:
        raise RuntimeError('isolated_root_builder_required; missing=' + ','.join(missing))
    if not (destination / 'auto/config').is_file():
        raise RuntimeError('prepared_directory_required')
    subprocess.run(['./auto/config'], cwd=destination, check=True)
    subprocess.run(['lb', 'build'], cwd=destination, check=True)
    image = destination / 'live-image-amd64.hybrid.iso'
    if not image.is_file():
        raise RuntimeError('expected_iso_missing')
    digest = hashlib.file_digest(image.open('rb'), 'sha256').hexdigest()
    write(destination, image.name + '.sha256', digest + '  ' + image.name + '\n')
    print('ISO built; boot and GUI verification still required: ' + str(image))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print('ATLAS OS: ' + str(error), file=sys.stderr)
        sys.exit(1)
