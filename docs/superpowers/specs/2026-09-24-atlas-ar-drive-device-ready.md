# ATLAS AR Drive — Device-ready automation

Date: 2026-09-24

## Objective

Convert the Unity AR Drive MVT from source scaffold into a reproducibly configured mobile AR project without claiming physical-device verification.

## Automated outputs

- AR scene generation
- arrow prefab/material generation
- Geospatial config asset
- AR Session + ARInputManager
- XR Origin + AR camera/background
- ARCore Extensions + Earth/Anchor managers
- route client and renderers
- split screen and mini-map
- Android/iOS Player settings
- ARCore/ARKit loader assignment
- fail-closed project validation
- command-line Android/iOS build entry points

## Privacy gate

Geospatial remains disabled until explicit runtime acknowledgement. The runtime checks support and location/Earth tracking before reporting Tracking.

## Alignment correction

Route arrows remain horizontal and use route bearing around the Y axis. The MVT estimates road altitude from camera geospatial altitude minus configurable device height. Outdoor calibration remains mandatory.

## Verification boundary

Source, repository, backend and deployment gates may be green independently of a physical AR session. The final AR device gate requires a real supported phone and must not be inferred from CI.
