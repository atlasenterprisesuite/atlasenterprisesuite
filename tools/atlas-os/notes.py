#!/usr/bin/env python3
"""ATLAS native desktop notes. Local vault only; no server or background networking."""
import json
import platform
import re
from pathlib import Path
import shutil
import subprocess
import tkinter as tk
from tkinter import messagebox, simpledialog


def request(action, passphrase, value=None, record="notes"):
    node = shutil.which('node')
    if not node:
        raise RuntimeError('Node.js 22+ requerido')
    payload = {'action': action, 'passphrase': passphrase, 'record': record}
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
        self.record, self.timer = "notes", None
        self.private_windows = []
        self.monitoring = tk.BooleanVar(value=False)
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
        self.build_menus()
        root.bind('<Control-n>', lambda _: self.new_note())
        root.bind('<Control-o>', lambda _: self.catalog())
        root.bind('<Control-l>', lambda _: self.lock())
        root.bind('<F1>', lambda _: self.help())

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
            data = request('load', password, record=self.record)
        except (RuntimeError, OSError, subprocess.TimeoutExpired) as error:
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
        self.root.title(f"ATLAS OS · {self.record}")
        self.text.focus_set()

    def save(self):
        if self.passphrase is None:
            return
        try:
            data = request('save', self.passphrase, self.text.get('1.0', 'end-1c'), record=self.record)
        except (RuntimeError, OSError, subprocess.TimeoutExpired) as error:
            messagebox.showerror('No se guardó: conserva tu texto', str(error), parent=self.root)
            return
        self.dirty = False
        self.text.edit_modified(False)
        self.status.set(f"Guardado cifrado local · {data['status']['pending']} cambios pendientes · Sin respaldo independiente")

    def lock(self):
        if self.dirty and not messagebox.askyesno('Cambios sin guardar', '¿Descartar los cambios sin guardar y bloquear?', parent=self.root):
            return False
        self.stop_monitor()
        for window in self.private_windows:
            if window.winfo_exists():
                window.destroy()
        self.private_windows.clear()
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

    def build_menus(self):
        bar = tk.Menu(self.root)
        self.root.configure(menu=bar)
        file_menu = tk.Menu(bar, tearoff=False)
        for label, command in [("Nueva nota  Ctrl+N", self.new_note), ("Abrir nota  Ctrl+O", self.catalog),
                               ("Guardar  Ctrl+S", self.save), ("Bloquear  Ctrl+L", self.lock), ("Salir", self.close)]:
            file_menu.add_command(label=label, command=command)
        bar.add_cascade(label="Archivo", menu=file_menu)
        edit = tk.Menu(bar, tearoff=False)
        for label, event in [("Deshacer", "<<Undo>>"), ("Rehacer", "<<Redo>>"), ("Cortar", "<<Cut>>"),
                             ("Copiar", "<<Copy>>"), ("Pegar", "<<Paste>>"), ("Seleccionar todo", "<<SelectAll>>")]:
            edit.add_command(label=label, command=lambda e=event: self.text.event_generate(e))
        bar.add_cascade(label="Editar", menu=edit)
        view = tk.Menu(bar, tearoff=False)
        view.add_command(label="Telaraña de navegación", command=self.web_map)
        view.add_command(label="Estado local y pendientes", command=self.show_status)
        view.add_checkbutton(label="Seguimiento local cada 30 segundos", variable=self.monitoring, command=self.toggle_monitor)
        view.add_command(label="Detener seguimiento", command=self.stop_monitor)
        bar.add_cascade(label="Ver", menu=view)
        system = tk.Menu(bar, tearoff=False)
        for label, command in [("Diagnóstico", self.diagnostics), ("Conexión entre dispositivos", self.connection_status),
                               ("Respaldo y persistencia", self.storage_status)]:
            system.add_command(label=label, command=command)
        bar.add_cascade(label="Sistema", menu=system)
        help_menu = tk.Menu(bar, tearoff=False)
        help_menu.add_command(label="Guía de uso  F1", command=self.help)
        bar.add_cascade(label="Ayuda", menu=help_menu)

    def require_unlocked(self):
        if self.passphrase is None:
            messagebox.showinfo("Bóveda bloqueada", "Desbloquea la bóveda para usar esta función.", parent=self.root)
            return False
        return True

    def leave_note(self):
        return not self.dirty or messagebox.askyesno("Cambios sin guardar", "¿Descartar cambios sin guardar y cambiar de nota?", parent=self.root)

    def select_note(self, record):
        if not self.require_unlocked() or not self.leave_note():
            return False
        try:
            data = request('load', self.passphrase, record=record)
        except (RuntimeError, OSError, subprocess.TimeoutExpired) as error:
            messagebox.showerror("No se pudo abrir", str(error), parent=self.root)
            return False
        self.record = record
        self.text.delete('1.0', 'end')
        self.text.insert('1.0', data['value'])
        self.text.edit_reset()
        self.text.edit_modified(False)
        self.dirty = False
        self.root.title(f"ATLAS OS · {record}")
        self.status.set(f"Nota: {record} · {data['status']['pending']} cambios pendientes · Sin transporte de sincronización")
        return True

    def new_note(self):
        if not self.require_unlocked():
            return
        name = simpledialog.askstring("Nueva nota", "Identificador: letras, números, punto, guion o guion bajo (máximo 64).", parent=self.root)
        if name is None:
            return
        if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}', name) or name in ['__proto__', 'constructor', 'prototype']:
            messagebox.showerror("Nombre inválido", "Usa un identificador válido.", parent=self.root)
            return
        if self.select_note(name):
            self.status.set("Nota abierta. Se creará o actualizará al guardar.")

    def catalog(self):
        if not self.require_unlocked():
            return
        try:
            data = request('load', self.passphrase, record=self.record)
        except (RuntimeError, OSError, subprocess.TimeoutExpired) as error:
            messagebox.showerror("No se pudo listar", str(error), parent=self.root)
            return
        window = tk.Toplevel(self.root)
        self.private_windows.append(window)
        window.title("Notas cifradas")
        window.geometry('420x320')
        choices = tk.Listbox(window, exportselection=False)
        choices.pack(fill='both', expand=True, padx=16, pady=16)
        for name in data['records']:
            choices.insert('end', name)
        def choose():
            selected = choices.curselection()
            if selected and self.select_note(choices.get(selected[0])):
                window.destroy()
        tk.Button(window, text="Abrir seleccionada", command=choose).pack(pady=8)
        choices.bind('<Double-Button-1>', lambda _: choose())
        choices.bind('<Return>', lambda _: choose())
        if not data['records']:
            tk.Label(window, text="Aún no hay notas guardadas.").pack()

    def refresh_status(self):
        data = request('load', self.passphrase, record=self.record)
        state = data['status']
        summary = f"{len(data['records'])} notas · {state['pending']} pendientes · {state['conflicts']} conflictos · {state['versions']} versiones"
        if not self.dirty:
            self.status.set(summary + " · Solo almacenamiento local")
        return summary

    def show_status(self):
        if not self.require_unlocked():
            return
        try:
            summary = self.refresh_status()
            messagebox.showinfo("Estado local", summary + "\nPendiente no significa enviado. No hay servidor conectado.", parent=self.root)
        except (RuntimeError, OSError, subprocess.TimeoutExpired) as error:
            messagebox.showerror("Estado no disponible", str(error), parent=self.root)

    def toggle_monitor(self):
        if not self.monitoring.get():
            self.stop_monitor()
            return
        if not self.require_unlocked():
            self.monitoring.set(False)
            return
        if self.timer is None:
            self.monitor_tick()

    def monitor_tick(self):
        self.timer = None
        if not self.monitoring.get() or self.passphrase is None:
            return
        try:
            self.refresh_status()
        except (RuntimeError, OSError, subprocess.TimeoutExpired):
            self.stop_monitor()
            self.status.set("Seguimiento detenido: no se pudo leer el estado local.")
            return
        self.timer = self.root.after(30000, self.monitor_tick)

    def stop_monitor(self):
        self.monitoring.set(False)
        if self.timer is not None:
            self.root.after_cancel(self.timer)
            self.timer = None

    def diagnostics(self):
        source = Path(__file__).resolve().parents[2] / 'SOURCE.json'
        revision = "Ejecución desde código; imagen instalada no verificada"
        try:
            manifest = json.loads(source.read_text())
            revision = "Fuente: " + str(manifest.get('revision', 'desconocida')) + "\nImagen certificada: no"
        except (OSError, ValueError):
            pass
        messagebox.showinfo("Diagnóstico", f"Sistema anfitrión: {platform.system()} {platform.machine()}\nPython: {platform.python_version()} · Tk: {tk.TkVersion}\nNode: {'disponible' if shutil.which('node') else 'no encontrado'}\n{revision}\nArranque de ISO y reinicio con persistencia: sin verificar", parent=self.root)

    def connection_status(self):
        messagebox.showinfo("Conexión", "Sin transporte autenticado entre dispositivos. No hay puerto que seleccionar.\nLa sincronización y resolución de conflictos siguen pendientes.", parent=self.root)

    def storage_status(self):
        messagebox.showinfo("Respaldo y persistencia", "Las notas se cifran en la bóveda local. El historial comparte el mismo archivo y no es un respaldo independiente.\nUna sesión Live sin persistencia pierde los datos al apagar. Conservación tras reiniciar: sin verificar.\nLímites: 8 KiB por nota; 64 KiB para el diario completo.", parent=self.root)

    def help(self):
        messagebox.showinfo("Guía de ATLAS OS", "1. Desbloquea la bóveda.\n2. Archivo → Nueva nota o Abrir nota.\n3. Guarda con Ctrl+S; bloquea con Ctrl+L.\n4. Ver → Telaraña conecta las secciones disponibles.\n5. Seguimiento local actualiza el estado cada 30 segundos; se detiene al bloquear o ante un error.\nEl prototipo aún no certifica un sistema operativo completo.", parent=self.root)

    def web_map(self):
        window = tk.Toplevel(self.root)
        window.title("ATLAS OS · Telaraña funcional")
        window.geometry('900x600')
        canvas = tk.Canvas(window, bg='#081426', highlightthickness=0)
        canvas.pack(fill='both', expand=True)
        nodes = [("Notas", self.catalog), ("Estado local", self.show_status), ("Bóveda", self.storage_status),
                 ("Conexión pendiente", self.connection_status), ("Diagnóstico", self.diagnostics), ("Guía", self.help)]
        def draw(_=None):
            canvas.delete('all')
            width, height = max(canvas.winfo_width(), 600), max(canvas.winfo_height(), 340)
            points = [(width * x, height * y) for x, y in [(0.2, 0.25), (0.5, 0.25), (0.8, 0.25), (0.2, 0.7), (0.5, 0.7), (0.8, 0.7)]]
            for a, b in [(0, 1), (1, 2), (0, 2), (1, 3), (1, 4), (2, 4), (4, 5), (0, 5)]:
                canvas.create_line(*points[a], *points[b], fill='#315f87', width=2)
            for index, ((label, command), (x, y)) in enumerate(zip(nodes, points)):
                tag = 'node-' + str(index)
                canvas.create_rectangle(x-85, y-28, x+85, y+28, fill='#10233b', outline='#ecc96e', tags=tag)
                canvas.create_text(x, y, text=label, fill='#e8f2ff', tags=tag)
                canvas.tag_bind(tag, '<Button-1>', lambda _, fn=command: fn())
        canvas.bind('<Configure>', draw)
        # Keyboard-accessible equivalents of every graph node.
        controls = tk.Frame(window)
        controls.pack(fill='x')
        for label, command in nodes:
            tk.Button(controls, text=label, command=command).pack(side='left', padx=2, pady=8)

    def close(self):
        if self.lock():
            self.root.destroy()


if __name__ == '__main__':
    root = tk.Tk()
    Notes(root)
    root.mainloop()
