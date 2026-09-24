using System;
using System.IO;
using System.Reflection;
using Atlas.ArDrive;
using Google.XR.ARCoreExtensions;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.XR.ARFoundation;

public static class AtlasArDriveSceneBuilder
{
    public const string ScenePath = "Assets/ATLAS/Scenes/AtlasArDrive.unity";
    public const string ArrowPrefabPath = "Assets/ATLAS/Prefabs/AtlasRouteArrow.prefab";
    public const string ArrowMaterialPath = "Assets/ATLAS/Materials/AtlasNeonArrow.mat";
    public const string MiniMapMaterialPath = "Assets/ATLAS/Materials/AtlasMiniMapRoute.mat";
    public const string ExtensionsConfigPath = "Assets/ATLAS/Config/AtlasARCoreExtensionsConfig.asset";

    [MenuItem("ATLAS/AR Drive/Generate Project Assets")]
    public static void GenerateAll()
    {
        EnsureFolders();
        var arrowMaterial = CreateArrowMaterial();
        var miniMapMaterial = CreateMiniMapMaterial();
        var arrowPrefab = CreateArrowPrefab(arrowMaterial);
        var config = CreateExtensionsConfig();
        CreateScene(arrowPrefab, miniMapMaterial, config);
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
        Debug.Log("ATLAS AR Drive assets generated.");
    }

    private static void EnsureFolders()
    {
        string[] folders =
        {
            "Assets/ATLAS",
            "Assets/ATLAS/Scenes",
            "Assets/ATLAS/Prefabs",
            "Assets/ATLAS/Materials",
            "Assets/ATLAS/Config"
        };

        foreach (var folder in folders)
        {
            if (AssetDatabase.IsValidFolder(folder)) continue;
            var parent = Path.GetDirectoryName(folder)?.Replace("\\", "/");
            var name = Path.GetFileName(folder);
            if (!string.IsNullOrWhiteSpace(parent) && AssetDatabase.IsValidFolder(parent))
                AssetDatabase.CreateFolder(parent, name);
        }
    }

    private static Material CreateArrowMaterial()
    {
        var material = AssetDatabase.LoadAssetAtPath<Material>(ArrowMaterialPath);
        if (material != null) return material;

        var shader = Shader.Find("ATLAS/AR/NeonArrow");
        if (shader == null) throw new InvalidOperationException("ATLAS NeonArrow shader is not imported.");
        material = new Material(shader) { name = "AtlasNeonArrow" };
        material.SetColor("_Color", new Color(0.08f, 0.72f, 1f, 0.76f));
        material.SetFloat("_Intensity", 5.5f);
        material.SetFloat("_FresnelPower", 2.1f);
        material.SetFloat("_PulseSpeed", 1.8f);
        material.SetFloat("_PulseAmount", 0.16f);
        AssetDatabase.CreateAsset(material, ArrowMaterialPath);
        return material;
    }

    private static Material CreateMiniMapMaterial()
    {
        var material = AssetDatabase.LoadAssetAtPath<Material>(MiniMapMaterialPath);
        if (material != null) return material;

        var shader = Shader.Find("Universal Render Pipeline/Unlit") ?? Shader.Find("Sprites/Default");
        if (shader == null) throw new InvalidOperationException("No compatible unlit shader found.");
        material = new Material(shader) { name = "AtlasMiniMapRoute" };
        if (material.HasProperty("_BaseColor")) material.SetColor("_BaseColor", new Color(0.1f, 0.75f, 1f, 1f));
        if (material.HasProperty("_Color")) material.SetColor("_Color", new Color(0.1f, 0.75f, 1f, 1f));
        AssetDatabase.CreateAsset(material, MiniMapMaterialPath);
        return material;
    }

    private static GameObject CreateArrowPrefab(Material material)
    {
        var existing = AssetDatabase.LoadAssetAtPath<GameObject>(ArrowPrefabPath);
        if (existing != null) return existing;

        var root = new GameObject("AtlasRouteArrow");
        var filter = root.AddComponent<MeshFilter>();
        var renderer = root.AddComponent<MeshRenderer>();
        filter.sharedMesh = CreateArrowMesh();
        renderer.sharedMaterial = material;
        root.transform.localScale = new Vector3(1.15f, 1.15f, 1.15f);

        var prefab = PrefabUtility.SaveAsPrefabAsset(root, ArrowPrefabPath);
        UnityEngine.Object.DestroyImmediate(root);
        return prefab;
    }

    private static Mesh CreateArrowMesh()
    {
        var mesh = new Mesh { name = "AtlasRouteArrowMesh" };
        mesh.vertices = new[]
        {
            new Vector3(-0.25f, 0f, -0.80f),
            new Vector3( 0.25f, 0f, -0.80f),
            new Vector3( 0.25f, 0f,  0.15f),
            new Vector3( 0.55f, 0f,  0.15f),
            new Vector3( 0.00f, 0f,  0.85f),
            new Vector3(-0.55f, 0f,  0.15f),
            new Vector3(-0.25f, 0f,  0.15f)
        };
        mesh.triangles = new[]
        {
            0,1,2, 0,2,6, 6,2,3, 6,3,5, 5,3,4,
            2,1,0, 6,2,0, 3,2,6, 5,3,6, 4,3,5
        };
        mesh.normals = new[]
        {
            Vector3.up,Vector3.up,Vector3.up,Vector3.up,Vector3.up,Vector3.up,Vector3.up
        };
        mesh.RecalculateBounds();
        return mesh;
    }

    private static ARCoreExtensionsConfig CreateExtensionsConfig()
    {
        var config = AssetDatabase.LoadAssetAtPath<ARCoreExtensionsConfig>(ExtensionsConfigPath);
        if (config == null)
        {
            config = ScriptableObject.CreateInstance<ARCoreExtensionsConfig>();
            AssetDatabase.CreateAsset(config, ExtensionsConfigPath);
        }

        var type = typeof(ARCoreExtensionsConfig);
        var prop = type.GetProperty("GeospatialMode", BindingFlags.Public | BindingFlags.Instance);
        if (prop != null && prop.CanWrite) prop.SetValue(config, GeospatialMode.Enabled);
        var field = type.GetField("GeospatialMode", BindingFlags.Public | BindingFlags.Instance);
        if (field != null) field.SetValue(config, GeospatialMode.Enabled);
        EditorUtility.SetDirty(config);
        return config;
    }

    private static void CreateScene(GameObject arrowPrefab, Material miniMapMaterial, ARCoreExtensionsConfig config)
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        var sessionObject = new GameObject("AR Session");
        var session = sessionObject.AddComponent<ARSession>();
        sessionObject.AddComponent<ARInputManager>();

        var originObject = new GameObject("XR Origin (AR)");
        var xrOriginType = Type.GetType("Unity.XR.CoreUtils.XROrigin, Unity.XR.CoreUtils");
        if (xrOriginType == null) throw new InvalidOperationException("XROrigin type is unavailable.");
        var xrOrigin = originObject.AddComponent(xrOriginType);
        var anchorManager = originObject.AddComponent<ARAnchorManager>();

        var cameraObject = new GameObject("AR Camera");
        cameraObject.tag = "MainCamera";
        cameraObject.transform.SetParent(originObject.transform, false);
        var arCamera = cameraObject.AddComponent<Camera>();
        arCamera.clearFlags = CameraClearFlags.SolidColor;
        arCamera.backgroundColor = Color.black;
        cameraObject.AddComponent<ARCameraManager>();
        cameraObject.AddComponent<ARCameraBackground>();
        AddComponentByTypeName(cameraObject, "UnityEngine.InputSystem.XR.TrackedPoseDriver, Unity.InputSystem");

        TryAssign(xrOrigin, arCamera, "m_Camera", "Camera", "camera");

        var extensionsObject = new GameObject("ARCore Extensions");
        var extensions = extensionsObject.AddComponent<ARCoreExtensions>();
        var earthManager = extensionsObject.AddComponent<AREarthManager>();
        TryAssign(extensions, session, "m_Session", "Session");
        TryAssign(extensions, xrOrigin, "m_XROrigin", "XROrigin", "Origin");
        TryAssign(extensions, cameraObject.GetComponent<ARCameraManager>(), "m_CameraManager", "CameraManager");
        TryAssign(extensions, config, "m_ARCoreExtensionsConfig", "ARCoreExtensionsConfig", "Config");

        var routeRoot = new GameObject("ATLAS AR Route");
        var routeClient = routeRoot.AddComponent<AtlasRouteClient>();
        var geospatialRenderer = routeRoot.AddComponent<AtlasGeospatialRouteRenderer>();
        var localRenderer = routeRoot.AddComponent<AtlasLocalRouteRenderer>();
        var controller = routeRoot.AddComponent<AtlasArDriveController>();
        var readiness = routeRoot.AddComponent<AtlasArDriveReadiness>();

        TryAssign(geospatialRenderer, earthManager, "earthManager");
        TryAssign(geospatialRenderer, anchorManager, "anchorManager");
        TryAssign(geospatialRenderer, arrowPrefab, "arrowPrefab");
        TryAssign(localRenderer, originObject.transform, "localOrigin");
        TryAssign(localRenderer, arrowPrefab, "arrowPrefab");
        TryAssign(controller, routeClient, "routeClient");
        TryAssign(controller, geospatialRenderer, "geospatialRenderer");
        TryAssign(controller, localRenderer, "localRenderer");
        TryAssign(readiness, earthManager, "earthManager");
        TryAssign(readiness, extensions, "arCoreExtensions");

        var mapRoot = new GameObject("ATLAS Mini Map");
        mapRoot.transform.position = new Vector3(0f, -100f, 0f);
        var line = mapRoot.AddComponent<LineRenderer>();
        line.sharedMaterial = miniMapMaterial;
        line.startWidth = 0.08f;
        line.endWidth = 0.08f;
        line.numCapVertices = 4;
        line.numCornerVertices = 4;
        var miniMap = mapRoot.AddComponent<AtlasMiniMapRouteRenderer>();

        var vehicle = GameObject.CreatePrimitive(PrimitiveType.Capsule);
        vehicle.name = "Vehicle Marker";
        vehicle.transform.SetParent(mapRoot.transform, false);
        vehicle.transform.localScale = new Vector3(0.12f, 0.04f, 0.20f);
        TryAssign(miniMap, vehicle.transform, "vehicleMarker");

        var mapCameraObject = new GameObject("Map Camera");
        var mapCamera = mapCameraObject.AddComponent<Camera>();
        mapCamera.orthographic = true;
        mapCamera.orthographicSize = 7f;
        mapCameraObject.transform.position = new Vector3(0f, -90f, 0f);
        mapCameraObject.transform.rotation = Quaternion.Euler(90f, 0f, 0f);

        var layoutObject = new GameObject("ATLAS Split Screen");
        var layout = layoutObject.AddComponent<AtlasSplitScreenLayout>();
        TryAssign(layout, arCamera, "arCamera");
        TryAssign(layout, mapCamera, "mapCamera");

        EditorSceneManager.SaveScene(scene, ScenePath);
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
    }

    private static Component AddComponentByTypeName(GameObject target, string assemblyQualifiedTypeName)
    {
        var type = Type.GetType(assemblyQualifiedTypeName);
        return type == null ? null : target.AddComponent(type);
    }

    private static void TryAssign(UnityEngine.Object target, UnityEngine.Object value, params string[] names)
    {
        if (target == null || value == null) return;
        var serialized = new SerializedObject(target);
        foreach (var name in names)
        {
            var property = serialized.FindProperty(name);
            if (property == null || property.propertyType != SerializedPropertyType.ObjectReference) continue;
            property.objectReferenceValue = value;
            serialized.ApplyModifiedPropertiesWithoutUndo();
            EditorUtility.SetDirty(target);
            return;
        }

        var type = target.GetType();
        foreach (var name in names)
        {
            var field = type.GetField(name, BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.IgnoreCase);
            if (field != null && field.FieldType.IsAssignableFrom(value.GetType()))
            {
                field.SetValue(target, value);
                EditorUtility.SetDirty(target);
                return;
            }

            var prop = type.GetProperty(name, BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.IgnoreCase);
            if (prop != null && prop.CanWrite && prop.PropertyType.IsAssignableFrom(value.GetType()))
            {
                prop.SetValue(target, value);
                EditorUtility.SetDirty(target);
                return;
            }
        }
    }
}
