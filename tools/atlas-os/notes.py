#!/usr/bin/env python3
"""ATLAS native desktop notes. Local vault only; no server or background networking."""
import json
from pathlib import Path
import shutil
import subprocess
import tkinter as tk
from tkinter import messagebox, simpledialog


def request(action, passphrase, value=None):
    node = shutil.which('node')
    if not node:
        raise RuntimeError('Node.js 22+ requerido')
    payload = {'action': action, 'passphrase': passphrase}
    if value is not None:
        payload['value'] = value
    result = subprocess.run(
        [node, str(Path(__file__).with_name('notes-bridge.mjs'))],
        input=json.dumps(payload), text=True, capture_output=True, timeout=20, check=False)
    try:
        data = json.loads(result.stdout)
    except (ValueError, TypeError):
        raise RuntimeError('No se pudo abrir la bóveda local') from None
    if result.returncode or not data.get('ok'):
        raise RuntimeError(data.get('error', 'native_request_failed'))
    return data


class Notes:
    def __init__(self, root):
        self.root, self.passphrase, self.dirty = root, None, False
        root.title('ATLAS OS · Notas locales')
        root.geometry('960x680')
        root.minsize(540, 420)
        root.configure(bg='#081426')
        tk.Label(root, text='ATLAS OS / LOCAL CORE', fg='#ecc96e', bg='#081426',
                 font=('Sans', 22, 'bold')).pack(anchor='w', padx=24, pady=(22, 6))
        tk.Label(root, text='Notas cifradas · Sin conexión con otros dispositivos',
                 fg='#a9c6e8', bg='#081426').pack(anchor='w', padx=24)
        tk.Label(root, text='Sesión de prueba: una imagen Live sin persistencia pierde los datos al apagar.',
                 fg='#ecc96e', bg='#081426', wraplength=850).pack(anchor='w', padx=24, pady=8)
        toolbar = tk.Frame(root, bg='#081426')
        toolbar.pack(fill='x', padx=24, pady=10)
        self.unlock = tk.Button(toolbar, text='Desbloquear bóveda', command=self.open)
        self.unlock.pack(side='left')
        self.save_button = tk.Button(toolbar, text='Guardar', command=self.save, state='disabled')
        self.save_button.pack(side='left', padx=12)
        self.lock_button = tk.Button(toolbar, text='Bloquear', command=self.lock, state='disabled')
        self.lock_button.pack(side='left')
        self.text = tk.Text(root, wrap='word', undo=True, bg='#10233b', fg='#e8f2ff',
                            insertbackground='#ecc96e', font=('Sans', 13), state='disabled')
        self.text.pack(fill='both', expand=True, padx=24, pady=8)
        self.text.bind('<<Modified>>', self.modified)
        self.status = tk.StringVar(value='Bóveda bloqueada. Sincronización y respaldo remoto: no configurados.')
        tk.Label(root, textvariable=self.status, fg='#a9c6e8', bg='#081426',
                 anchor='w', wraplength=850).pack(fill='x', padx=24, pady=16)
        root.bind('<Control-s>', lambda _: self.save())
        root.protocol('WM_DELETE_WINDOW', self.close)

    def modified(self, _):
        if self.text.edit_modified():
            self.dirty = True
            self.text.edit_modified(False)
            self.status.set('Cambios sin guardar. Ctrl+S para guardarlos localmente.')

    def open(self):
        password = simpledialog.askstring('Bóveda local', 'Contraseña local (mínimo 12 bytes).\nPara una bóveda nueva, elige una contraseña única.', show='*', parent=self.root)
        if password is None:
            return
        try:
            data = request('load', password)
        except (RuntimeError, subprocess.TimeoutExpired) as error:
            messagebox.showerror('No se pudo desbloquear', str(error), parent=self.root)
            return
        self.passphrase = password
        self.text.configure(state='normal')
        self.text.delete('1.0', 'end')
        self.text.insert('1.0', data['value'])
        self.text.edit_reset()
        self.text.edit_modified(False)
        self.dirty = False
        self.unlock.configure(state='disabled')
        self.save_button.configure(state='normal')
        self.lock_button.configure(state='normal')
        self.status.set(f"Bóveda local abierta · {data['status']['pending']} cambios pendientes · Sin transporte de sincronización")
        self.text.focus_set()

    def save(self):
        if self.passphrase is None:
            return
        try:
            data = request('save', self.passphrase, self.text.get('1.0', 'end-1c'))
        except (RuntimeError, subprocess.TimeoutExpired) as error:
            messagebox.showerror('No se guardó: conserva tu texto', str(error), parent=self.root)
            return
        self.dirty = False
        self.text.edit_modified(False)
        self.status.set(f"Guardado cifrado local · {data['status']['pending']} cambios pendientes · Sin respaldo independiente")

    def lock(self):
        if self.dirty and not messagebox.askyesno('Cambios sin guardar', '¿Descartar los cambios sin guardar y bloquear?', parent=self.root):
            return False
        self.passphrase = None
        self.text.configure(state='normal')
        self.text.delete('1.0', 'end')
        self.text.edit_reset()
        self.text.edit_modified(False)
        self.text.configure(state='disabled')
        self.dirty = False
        self.unlock.configure(state='normal')
        self.save_button.configure(state='disabled')
        self.lock_button.configure(state='disabled')
        self.status.set('Bóveda bloqueada. Sincronización y respaldo remoto: no configurados.')
        return True

    def close(self):
        if self.lock():
            self.root.destroy()


if __name__ == '__main__':
    root = tk.Tk()
    Notes(root)
    root.mainloop()
