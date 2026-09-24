using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.XR.Management;
using UnityEditor.XR.Management.Metadata;
using UnityEngine.XR.Management;

public static class AtlasArDriveBuild
{
    [MenuItem("ATLAS/AR Drive/Configure Project")]
    public static void ConfigureProject()
    {
        AtlasArDriveSceneBuilder.GenerateAll();

        PlayerSettings.companyName = "ATLAS Enterprise Suite";
        PlayerSettings.productName = "ATLAS AR Drive";
        PlayerSettings.bundleVersion = "0.1.0";
        PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, "com.atlasenterprisesuite.ardrive");
        PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.iOS, "com.atlasenterprisesuite.ardrive");

        PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel26;
        PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevelAuto;
        PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
        PlayerSettings.SetScriptingBackend(BuildTargetGroup.Android, ScriptingImplementation.IL2CPP);

        PlayerSettings.iOS.targetOSVersionString = "15.0";
        PlayerSettings.iOS.cameraUsageDescription = "ATLAS AR Drive uses the rear camera to place navigation guidance on the road ahead.";
        PlayerSettings.iOS.locationUsageDescription = "ATLAS AR Drive uses precise location to align navigation guidance with the real world.";
        PlayerSettings.SetScriptingBackend(BuildTargetGroup.iOS, ScriptingImplementation.IL2CPP);

#pragma warning disable CS0618
        PlayerSettings.SetPropertyInt("activeInputHandler", 2, BuildTargetGroup.Android);
        PlayerSettings.SetPropertyInt("activeInputHandler", 2, BuildTargetGroup.iOS);
#pragma warning restore CS0618

        ConfigureLoader(BuildTargetGroup.Android, "UnityEngine.XR.ARCore.ARCoreLoader");
        ConfigureLoader(BuildTargetGroup.iOS, "UnityEngine.XR.ARKit.ARKitLoader");

        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
        ValidateProject();
        UnityEngine.Debug.Log("ATLAS AR Drive project configured.");
    }

    [MenuItem("ATLAS/AR Drive/Validate Project")]
    public static void ValidateProject()
    {
        string[] required =
        {
            AtlasArDriveSceneBuilder.ScenePath,
            AtlasArDriveSceneBuilder.ArrowPrefabPath,
            AtlasArDriveSceneBuilder.ArrowMaterialPath,
            AtlasArDriveSceneBuilder.ExtensionsConfigPath,
            "Assets/Plugins/Android/AndroidManifest.xml"
        };

        foreach (var path in required)
            if (!File.Exists(path) && AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(path) == null)
                throw new InvalidOperationException("Missing ATLAS AR Drive asset: " + path);

        ValidateLoader(BuildTargetGroup.Android, "UnityEngine.XR.ARCore.ARCoreLoader");
        ValidateLoader(BuildTargetGroup.iOS, "UnityEngine.XR.ARKit.ARKitLoader");

        var scenes = EditorBuildSettings.scenes.Where(scene => scene.enabled).Select(scene => scene.path).ToArray();
        if (!scenes.Contains(AtlasArDriveSceneBuilder.ScenePath))
            throw new InvalidOperationException("ATLAS AR Drive scene is not enabled in Build Settings.");
    }

    public static void BuildAndroidCI()
    {
        ConfigureProject();
        Directory.CreateDirectory("Builds/Android");
        BuildOrThrow(BuildTarget.Android, "Builds/Android/AtlasArDrive.apk");
    }

    public static void BuildIOSCI()
    {
        ConfigureProject();
        Directory.CreateDirectory("Builds/iOS");
        BuildOrThrow(BuildTarget.iOS, "Builds/iOS");
    }

    private static void ConfigureLoader(BuildTargetGroup group, string loaderTypeName)
    {
        var settings = XRGeneralSettingsPerBuildTarget.XRGeneralSettingsForBuildTarget(group);
        if (settings == null)
            throw new InvalidOperationException("XR Plugin Management settings are missing for " + group + ". Open the project once after package resolution and rerun Configure Project.");

        settings.InitManagerOnStart = true;
        bool alreadyAssigned = settings.Manager.activeLoaders.Any(loader => loader != null && loader.GetType().FullName == loaderTypeName);
        if (!alreadyAssigned && !XRPackageMetadataStore.AssignLoader(settings.Manager, loaderTypeName, group))
            throw new InvalidOperationException("Unable to assign XR loader " + loaderTypeName + " for " + group);

        EditorUtility.SetDirty(settings);
    }

    private static void ValidateLoader(BuildTargetGroup group, string loaderTypeName)
    {
        var settings = XRGeneralSettingsPerBuildTarget.XRGeneralSettingsForBuildTarget(group);
        if (settings == null || settings.Manager == null)
            throw new InvalidOperationException("XR settings unavailable for " + group);

        bool assigned = settings.Manager.activeLoaders.Any(loader => loader != null && loader.GetType().FullName == loaderTypeName);
        if (!assigned)
            throw new InvalidOperationException("Required XR loader is not assigned: " + loaderTypeName);
    }

    private static void BuildOrThrow(BuildTarget target, string location)
    {
        var options = new BuildPlayerOptions
        {
            scenes = EditorBuildSettings.scenes.Where(scene => scene.enabled).Select(scene => scene.path).ToArray(),
            target = target,
            locationPathName = location,
            options = BuildOptions.Development
        };

        BuildReport report = BuildPipeline.BuildPlayer(options);
        if (report.summary.result != BuildResult.Succeeded)
            throw new InvalidOperationException($"ATLAS AR Drive {target} build failed: {report.summary.result}, errors={report.summary.totalErrors}");
    }
}
