#if UNITY_EDITOR
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace MuseLab.Editor
{
    [InitializeOnLoad]
    static class PlayModeStartScene
    {
        const string SplashScenePath = "Assets/MuseLab/Scenes/Splash.unity";

        static PlayModeStartScene()
        {
            var splash = AssetDatabase.LoadAssetAtPath<SceneAsset>(SplashScenePath);
            if (splash == null)
            {
                Debug.LogWarning($"MuseLab play mode start scene not found at {SplashScenePath}");
                return;
            }

            EditorSceneManager.playModeStartScene = splash;
        }
    }
}
#endif
