# ATLAS Phone Bridge — implementación local

ATLAS Phone Bridge conecta un teléfono **Android** autorizado y una computadora **Windows/macOS/Linux** para duplicar/controlar pantalla y transferir archivos. Extiende `tools/local-agent`: no crea otro plano de control. Sin nube, suscripción ni root.

## Windows 11

1. Instala Node.js 22+ y abre el repositorio oficial ATLAS.
2. Desde PowerShell instala scrcpy y ADB siguiendo la guía oficial: `winget install --exact Genymobile.scrcpy`. Reinicia la terminal y verifica `adb version` y `scrcpy --version`.
3. Activa Opciones de desarrollador y Depuración USB en un teléfono Android que controles. Conecta con cable de datos; desbloquea y autoriza la huella RSA de la computadora.
4. En la raíz del repositorio ejecuta `node tools/local-agent/atlas-phone-bridge.mjs`.
5. Abre `http://127.0.0.1:8765` en esa misma computadora, selecciona el teléfono autorizado, elige perfil y pulsa **Abrir pantalla**.
6. Para enviar archivos usa **Enviar al teléfono** (máx. 32 MiB). Llegarán a `/sdcard/Download/ATLASBridge/`.
7. Pulsa **Detener** y luego Ctrl+C en la terminal para finalizar.

macOS: `brew install scrcpy android-platform-tools`. Ubuntu/Linux: `sudo apt install adb scrcpy` (los paquetes pueden estar desactualizados). Usa el mismo comando Node.js.

## Wi-Fi local seguro

En Android 11+ con Wireless debugging puedes emparejar ADB por la red local. El puerto de emparejamiento puede diferir del de conexión:

1. Ejecuta `adb pair PHONE_LAN_IP:PAIRING_PORT` e introduce el código que muestra Android.
2. Ejecuta `adb connect PHONE_LAN_IP:CONNECT_PORT`.
3. Comprueba el estado con `adb devices -l`.

Phone Bridge detecta dispositivos autorizados previamente. No abre `adb tcpip 5555` ni escanea redes; con USB no se necesita Internet.

## Seguridad, verificaciones y límites

- Solo escucha en `127.0.0.1`, valida Host y token de sesión aleatorio y requiere Origin local para acciones mutantes.
- CSP, encabezados de seguridad y denegación de iframes. No hay secretos ni archivos subidos a la nube.
- Sin ejecución arbitraria de ADB. Solamente consultas de dispositivos, apertura de scrcpy y transferencia a Descargas/ATLASBridge; nombres de archivos sanitizados y destino fijo.
- Rechaza teléfonos con estado `unauthorized` u `offline`. La presencia de un proceso scrcpy **no prueba** que una pantalla se haya mostrado.
- Transferencias limitadas a 32 MiB; temporales locales privados eliminados al concluir.
- El uso manual local no concede permisos remotos a ATLAS. Una futura sesión remota debe pasar por ATLAS Local Control Plane, su RBAC, mTLS, consentimiento, auditoría y aprobaciones.
- iPhone necesita adaptador separado: iPhone Mirroring oficial en Mac compatible. No afirmar control remoto general de iOS desde Windows.

## Criterios

- [x] Panel HTTP local con estado real de dependencias y dispositivos.
- [x] Perfiles de duplicación fijos y transferencias acotadas.
- [x] Pruebas unitarias y controles de sesión/origen/host.
- [ ] Verificación física Android + Windows/macOS/Linux: fotogramas, teclado, transferencias y reconexión.
- [ ] Instaladores firmados, distribución y evidencias de rendimiento.
- [ ] Carpetas bidireccionales con reanudación e integración nativa iPhone.

Pruebas: `node --test tools/local-agent/tests/phone-bridge.test.mjs` y `node --check tools/local-agent/atlas-phone-bridge.mjs`.

Referencias: https://github.com/Genymobile/scrcpy ; https://developer.android.com/tools/adb ; https://support.apple.com/en-us/120421 .
