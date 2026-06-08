import { useProjectStore, selectActiveStory } from "@/store/projectStore";

export function useActiveStory() {
  const project = useProjectStore((s) => s.project);
  const activeStoryId = useProjectStore((s) => s.activeStoryId);
  const story = selectActiveStory(project, activeStoryId);
  return { project, story, storyId: story.id };
}
