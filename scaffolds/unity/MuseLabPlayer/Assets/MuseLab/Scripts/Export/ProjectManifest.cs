using System;
using System.Collections.Generic;

namespace MuseLab.Export
{
    [Serializable]
    public class ActorConfigData
    {
        public string assetId;
        public string expressionId;
    }

    [Serializable]
    public class SoundConfigData
    {
        public string assetId;
        public bool startOnLoad;
        public bool stopOnLoad;
        public bool loop;
        public double startTime;
        public double endTime;
    }

    [Serializable]
    public class StoryNodeVisual
    {
        public string id;
        public string type;
        public string backdropId;
        public ActorConfigData[] actorConfigs = Array.Empty<ActorConfigData>();
        public SoundConfigData[] soundConfigs = Array.Empty<SoundConfigData>();
    }

    [Serializable]
    public class StoryManifest
    {
        public string id;
        public string name;
        public string entryNodeId;
        public StoryNodeVisual[] nodes = Array.Empty<StoryNodeVisual>();
    }

    [Serializable]
    public class PlayerResolutionData
    {
        public int width;
        public int height;
    }

    [Serializable]
    public class AssetItem
    {
        public string id;
        public string type;
        public string name;
        public string url;
    }

    [Serializable]
    public class ProjectManifest
    {
        public string name;
        public string defaultLocale = "en";
        public PlayerResolutionData playerResolution;
        public StoryManifest[] stories = Array.Empty<StoryManifest>();
        public AssetItem[] assets = Array.Empty<AssetItem>();

        public StoryNodeVisual FindNode(string storyId, string nodeId)
        {
            foreach (var story in stories)
            {
                if (story.id != storyId) continue;
                foreach (var node in story.nodes)
                {
                    if (node.id == nodeId) return node;
                }
            }
            return null;
        }

        public string FindEntryStoryId()
        {
            if (stories.Length == 0) return null;
            return stories[0].id;
        }

        public string FindEntryNodeId(string storyId)
        {
            foreach (var story in stories)
            {
                if (story.id == storyId && !string.IsNullOrEmpty(story.entryNodeId))
                    return story.entryNodeId;
            }
            return null;
        }

        public (int width, int height) GetPlayerResolution()
        {
            if (playerResolution != null && playerResolution.width > 0 && playerResolution.height > 0)
                return (playerResolution.width, playerResolution.height);
            return (1280, 720);
        }
    }
}
