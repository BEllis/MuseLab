// Generated automatically with "cito". Do not edit.

public abstract class IMuseLabRuntime
{

	public abstract string GetString(string key);

	public abstract bool GetBool(string key);

	public abstract int GetInt(string key);

	public abstract void SetString(string key, string value);

	public abstract void SetBool(string key, bool value);

	public abstract void SetInt(string key, int value);

	public abstract void Emit(string eventName);

	public abstract string Call(string name);

	public abstract void PlaySound(string assetId);

	public abstract void PlaySoundTrim(string assetId, double startTime, double endTime);

	public abstract void PlaySoundClip(string assetId, double delaySeconds, double startTime, double endTime);

	public abstract void PlaySoundClipByPath(string groupPath, string assetName, double delaySeconds, double startTime, double endTime);
}

public abstract class IMuseLabFormat
{

	public abstract string BoldStart();

	public abstract string BoldEnd();

	public abstract string ItalicStart();

	public abstract string ItalicEnd();

	public abstract string ColorStart(string colorHex);

	public abstract string ColorEnd();

	public abstract string ShakeCharsStart();

	public abstract string ShakeCharsEnd();

	public abstract string ShakePhraseStart();

	public abstract string ShakePhraseEnd();

	public abstract string ShakeCharsText(string text);

	public abstract string ShakePhraseText(string text);

	public abstract string FontStyleBegin(string fontAssetId, int fontSizePx, int fontWeight);

	public abstract string FontStyleByPathBegin(string groupPath, string assetName, int fontSizePx, int fontWeight);

	public abstract string FontStyleEnd();

	public abstract string FontSizeBegin(int fontSizePx);

	public abstract string FontSizeEnd();

	public abstract string FontWeightBegin(int fontWeight);

	public abstract string FontWeightEnd();
}

public abstract class IMuseLabPromptRenderer
{

	public abstract void AddLiteral(string text);

	public abstract void AppendResult(string value);

	public abstract void ApplyFormat(string marker);

	public abstract void WaitInMs(int milliseconds);

	public abstract void RevealCharsBegin(double charsPerSecond);

	public abstract void RevealWordsBegin(double wordsPerSecond);

	public abstract void RevealCharsOverTimeBegin(int durationMs);

	public abstract void RevealWordsOverTimeBegin(int durationMs);

	public abstract void RevealEnd();

	public abstract void WaitForContinue();

	public abstract void UpdateSpeaker(string template);

	public abstract void Reset();

	public abstract void Clear();

	public abstract string Render();
}

public class RuntimeChoices
{
	public RuntimeChoices()
	{
	}

	int count;

	RuntimeChoice[] items;

	public static RuntimeChoices Create(int count, RuntimeChoice[] items)
	{
		RuntimeChoices holder = new RuntimeChoices();
		holder.count = count;
		holder.items = items;
		return holder;
	}

	public int GetCount()
	{
		return this.count;
	}

	public RuntimeChoice[] GetItems()
	{
		return this.items;
	}
}

public class RuntimeChoice
{
	public RuntimeChoice()
	{
	}

	string edgeId;

	string targetNodeId;

	string optionText;

	public static RuntimeChoice Create(string edgeId, string targetNodeId, string optionText)
	{
		RuntimeChoice choice = new RuntimeChoice();
		choice.edgeId = edgeId;
		choice.targetNodeId = targetNodeId;
		choice.optionText = optionText;
		return choice;
	}

	public string GetEdgeId()
	{
		return this.edgeId;
	}

	public string GetTargetNodeId()
	{
		return this.targetNodeId;
	}

	public string GetOptionText()
	{
		return this.optionText;
	}
}

public class RuntimeState
{
	public RuntimeState()
	{
	}

	string activeStoryId;

	string currentNodeId;

	string currentHtml;

	string currentSpeaker;

	int choiceCount;

	RuntimeChoice[] choices;

	bool isTerminalScene;

	bool isEnded;

	public static RuntimeState Create(string activeStoryId, string currentNodeId, string currentHtml, string currentSpeaker, int choiceCount, RuntimeChoice[] choices, bool isTerminalScene, bool isEnded)
	{
		RuntimeState state = new RuntimeState();
		state.activeStoryId = activeStoryId;
		state.currentNodeId = currentNodeId;
		state.currentHtml = currentHtml;
		state.currentSpeaker = currentSpeaker;
		state.choiceCount = choiceCount;
		state.choices = choices;
		state.isTerminalScene = isTerminalScene;
		state.isEnded = isEnded;
		return state;
	}

	public string GetActiveStoryId()
	{
		return this.activeStoryId;
	}

	public string GetCurrentNodeId()
	{
		return this.currentNodeId;
	}

	public string GetCurrentHtml()
	{
		return this.currentHtml;
	}

	public string GetCurrentSpeaker()
	{
		return this.currentSpeaker;
	}

	public int GetChoiceCount()
	{
		return this.choiceCount;
	}

	public RuntimeChoice GetChoice(int index)
	{
		return this.choices[index];
	}

	public bool GetIsTerminalScene()
	{
		return this.isTerminalScene;
	}

	public bool GetIsEnded()
	{
		return this.isEnded;
	}
}

public static class MuseLabProjectData
{

	public static string ResolveStoryId(string groupPath, string storyName)
	{
		if (groupPath == "" && storyName == "Main")
			return "4bc03f21-6d66-4574-b460-8acb7aee194e";
		return "";
	}

	public static string GetStoryEntryNodeId(string storyId)
	{
		if (storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e")
			return "3a0802c5-5a08-4e22-baec-4a1c50001a20";
		return "";
	}

	public static string ResolveStartNodeId(string storyId, string startNodeName)
	{
		if (storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && startNodeName == "Start")
			return "3a0802c5-5a08-4e22-baec-4a1c50001a20";
		return "";
	}

	public static int GetNodeKind(string storyId, string nodeId)
	{
		if (storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && nodeId == "3a0802c5-5a08-4e22-baec-4a1c50001a20")
			return 0;
		if (storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && nodeId == "36432447-13d2-43e5-90a3-5885d9bb9a4b")
			return 1;
		if (storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && nodeId == "430bc2d5-0a01-404d-9b83-c5b1a0f14fd2")
			return 1;
		return -1;
	}

	public static string GetJumpTargetStoryId(string storyId, string nodeId)
	{
		return "";
	}

	public static string GetJumpTargetStartNodeId(string storyId, string nodeId)
	{
		return "";
	}

	public static int GetOutgoingEdgeCount(string storyId, string nodeId)
	{
		if (storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && nodeId == "3a0802c5-5a08-4e22-baec-4a1c50001a20")
			return 1;
		if (storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && nodeId == "36432447-13d2-43e5-90a3-5885d9bb9a4b")
			return 1;
		if (storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && nodeId == "430bc2d5-0a01-404d-9b83-c5b1a0f14fd2")
			return 0;
		return 0;
	}

	public static string GetOutgoingEdgeId(string storyId, string nodeId, int index)
	{
		if (storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && nodeId == "3a0802c5-5a08-4e22-baec-4a1c50001a20") {
			if (index == 0)
				return "9ff4e676-c0fd-4f91-a409-0fe33c4b1096";
			return "";
		}
		if (storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && nodeId == "36432447-13d2-43e5-90a3-5885d9bb9a4b") {
			if (index == 0)
				return "d91a0c84-1f27-4adf-9a8f-e8972918ea0f";
			return "";
		}
		if (storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && nodeId == "430bc2d5-0a01-404d-9b83-c5b1a0f14fd2") {
			return "";
		}
		return "";
	}

	public static string GetEdgeTargetNodeId(string storyId, string edgeId)
	{
		if (storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && edgeId == "9ff4e676-c0fd-4f91-a409-0fe33c4b1096")
			return "36432447-13d2-43e5-90a3-5885d9bb9a4b";
		if (storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && edgeId == "d91a0c84-1f27-4adf-9a8f-e8972918ea0f")
			return "430bc2d5-0a01-404d-9b83-c5b1a0f14fd2";
		return "";
	}

	public static void ApplyStoryGlobalState(string storyId, IMuseLabRuntime rt)
	{
	}

	public static string GetAssetArchivePath(string assetId)
	{
		if (assetId == "muselab-default-backdrop")
			return "assets/backdrops/muselab-default-backdrop.bin";
		if (assetId == "muselab-default-font")
			return "assets/fonts/muselab-default-font.bin";
		return "";
	}
}

public static class Template_9d971ad3
{

	public static string Render(IMuseLabRuntime rt, IMuseLabPromptRenderer prompter, IMuseLabFormat format)
	{
		prompter.AddLiteral("Something really long Something really long Something really long Something really long Something really long Something really long Something really long Something really longSomething really long Something really long Something really long Something really long Something really long Something really long Something really long Something really longSomething really long Something really long Something really long Something really long Something really long Something really long Something really long Something really longSomething really long Something really long Something really long Something really long Something really long Something really long Something really long Something really longSomething really long Something really long Something really long Something really long Something really long Something really long Something really long Something really longlong Something really long Something really long Something really long Something really longSomething really long Something really long Something really long Something really long Something really long Something really long Something really lg Something really long Something really long Something really long Something really longSomething really long Something really long Something really long Something really long Something really long Something really long Something really long Something really longSomething really long Something really long Something really long Something really long Something really long Something really long Something really long Something really longlong Something really long Something really long Something really long Something really longSomething really long Something really long Something really long Something really long Something really long Something really long Something really lg Something really long Something really long Something really long Something really longSomething really long Something really long Something really long Something really long Something really long Something really long Something really long Something really longSomething really long Something really long Something really long Something really long Something really long Something really long Something really long Something really longlong Something really long Something really long Something really long Something really longSomething really long Something really long Something really long Something really long Something really long Something really long Something really long Something really longSomething really long Something really long Something really long Something really long Something really long Something really long Something really long Something really long long Something really long Something really long Something really long Something really longSomething really long Something really long Something really long Something really long Something really long Something really long Something really long Something really longSomething really long Something really long Something really long Something really long Something really long Something really long Something really long Something really longABC\n\n");
		prompter.RevealWordsBegin(-1);
		prompter.AddLiteral("Something really long Something really long Something really long Something really long Something really long Something really long Something really long Something really long");
		prompter.RevealEnd();
		prompter.AddLiteral("\n\n");
		prompter.RevealWordsBegin(-1);
		prompter.AddLiteral("Something really long Something really long Something really long Something really long Something really long Something really long Something really long Something really long");
		prompter.RevealEnd();
		prompter.AddLiteral("\n\nThe end");
		return prompter.Render();
	}
}

public static class Template_2cdd8587
{

	public static string Render(IMuseLabRuntime rt, IMuseLabPromptRenderer prompter, IMuseLabFormat format)
	{
		prompter.AddLiteral("Alice");
		return prompter.Render();
	}
}

public static class Template_5f0ef027
{

	public static string Render(IMuseLabRuntime rt, IMuseLabPromptRenderer prompter, IMuseLabFormat format)
	{
		prompter.ApplyFormat(format.ShakePhraseStart());
		prompter.AddLiteral("Crazy!!");
		prompter.ApplyFormat(format.ShakePhraseEnd());
		return prompter.Render();
	}
}

public class MuseLabEngine
{
	public MuseLabEngine()
	{
		this.activeStoryId = "";
		this.currentNodeId = "";
		this.isEnded = false;
	}

	IMuseLabRuntime rt;

	IMuseLabFormat format;

	IMuseLabPromptRenderer prompter;

	string activeLocale;

	string activeStoryId;

	string currentNodeId;

	bool isEnded;

	public static MuseLabEngine Create(IMuseLabRuntime rt, IMuseLabFormat format, IMuseLabPromptRenderer prompter, string defaultLocale)
	{
		MuseLabEngine engine = new MuseLabEngine();
		engine.rt = rt;
		engine.format = format;
		engine.prompter = prompter;
		engine.activeLocale = defaultLocale;
		return engine;
	}

	public void Start()
	{
		StartStoryById("4bc03f21-6d66-4574-b460-8acb7aee194e");
	}

	public void StartStoryById(string storyId)
	{
		string startNodeId = MuseLabProjectData.GetStoryEntryNodeId(storyId);
		if (startNodeId == "")
			return;
		StartStory(storyId, startNodeId);
	}

	public void StartStoryByIdAtNode(string storyId, string startNodeId)
	{
		if (storyId == "" || startNodeId == "")
			return;
		StartStory(storyId, startNodeId);
	}

	public void StartStoryByPath(string groupPath, string storyName)
	{
		string storyId = MuseLabProjectData.ResolveStoryId(groupPath, storyName);
		if (storyId == "")
			return;
		StartStoryById(storyId);
	}

	public void StartStoryByPathAtStartNode(string groupPath, string storyName, string startNodeName)
	{
		string storyId = MuseLabProjectData.ResolveStoryId(groupPath, storyName);
		if (storyId == "")
			return;
		string startNodeId = MuseLabProjectData.ResolveStartNodeId(storyId, startNodeName);
		if (startNodeId == "")
			return;
		StartStory(storyId, startNodeId);
	}

	public void SetActiveLocale(string locale)
	{
		this.activeLocale = locale;
	}

	public string GetActiveLocale()
	{
		return this.activeLocale;
	}

	public void FinishStory()
	{
		this.isEnded = true;
	}

	public void GoToNode(string nodeId)
	{
		int kind = MuseLabProjectData.GetNodeKind(this.activeStoryId, nodeId);
		if (kind < 0)
			return;
		if (kind == 2) {
			string targetStoryId = MuseLabProjectData.GetJumpTargetStoryId(this.activeStoryId, nodeId);
			string targetStartNodeId = MuseLabProjectData.GetJumpTargetStartNodeId(this.activeStoryId, nodeId);
			SwitchStory(targetStoryId, targetStartNodeId);
			return;
		}
		this.currentNodeId = nodeId;
		this.isEnded = false;
	}

	public RuntimeState GetRuntimeState()
	{
		int kind = MuseLabProjectData.GetNodeKind(this.activeStoryId, this.currentNodeId);
		string html = "";
		string speaker = "";
		int choiceCount = 0;
		RuntimeChoice[] choices = new RuntimeChoice[0];
		bool isTerminalScene = false;
		if (kind == 1) {
			html = RenderNodePrompt(this.activeLocale, this.activeStoryId, this.currentNodeId);
			speaker = RenderNodeSpeaker(this.activeLocale, this.activeStoryId, this.currentNodeId);
		}
		if (kind == 0 || kind == 1) {
			RuntimeChoices builtChoices = BuildChoices();
			choiceCount = builtChoices.GetCount();
			choices = builtChoices.GetItems();
		}
		if (kind == 1
			&& this.activeStoryId == "4bc03f21-6d66-4574-b460-8acb7aee194e"
			&& this.currentNodeId == "430bc2d5-0a01-404d-9b83-c5b1a0f14fd2"
			&& choiceCount == 0)
			isTerminalScene = true;
		return RuntimeState.Create(this.activeStoryId, this.currentNodeId, html, speaker, choiceCount, choices, isTerminalScene, this.isEnded);
	}

	void StartStory(string storyId, string startNodeId)
	{
		MuseLabProjectData.ApplyStoryGlobalState(storyId, this.rt);
		this.activeStoryId = storyId;
		this.currentNodeId = startNodeId;
		this.isEnded = false;
	}

	void SwitchStory(string storyId, string startNodeId)
	{
		MuseLabProjectData.ApplyStoryGlobalState(storyId, this.rt);
		this.activeStoryId = storyId;
		this.currentNodeId = startNodeId;
		this.isEnded = false;
	}

	RuntimeChoices BuildChoices()
	{
		int edgeCount = MuseLabProjectData.GetOutgoingEdgeCount(this.activeStoryId, this.currentNodeId);
		RuntimeChoice[] result = new RuntimeChoice[edgeCount];
		int count = 0;
		for (int i = 0; i < edgeCount; i++) {
			string edgeId = MuseLabProjectData.GetOutgoingEdgeId(this.activeStoryId, this.currentNodeId, i);
			if (!EvaluateEdgeCondition(this.activeStoryId, edgeId))
				continue;
			string targetNodeId = MuseLabProjectData.GetEdgeTargetNodeId(this.activeStoryId, edgeId);
			int targetKind = MuseLabProjectData.GetNodeKind(this.activeStoryId, targetNodeId);
			string optionText = "";
			if (targetKind == 1)
				optionText = RenderEdgeOption(this.activeLocale, this.activeStoryId, edgeId);
			result[count] = RuntimeChoice.Create(edgeId, targetNodeId, optionText);
			count++;
		}
		return RuntimeChoices.Create(count, result);
	}

	string RenderNodePrompt(string locale, string storyId, string nodeId)
	{
		if (locale == "en" && storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && nodeId == "36432447-13d2-43e5-90a3-5885d9bb9a4b")
			return Template_9d971ad3.Render(this.rt, this.prompter, this.format);
		if (locale == "en" && storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && nodeId == "430bc2d5-0a01-404d-9b83-c5b1a0f14fd2")
			return Template_5f0ef027.Render(this.rt, this.prompter, this.format);
		return "";
	}

	string RenderNodeSpeaker(string locale, string storyId, string nodeId)
	{
		// Speaker templates must not reuse the prompt prompter; it would append to dialogue markup/instructions.
		if (locale == "en" && storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && nodeId == "36432447-13d2-43e5-90a3-5885d9bb9a4b")
			return "Alice";
		if (locale == "en" && storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && nodeId == "430bc2d5-0a01-404d-9b83-c5b1a0f14fd2")
			return "Alice";
		return "";
	}

	string RenderEdgeOption(string locale, string storyId, string edgeId)
	{
		return "";
	}

	bool EvaluateEdgeCondition(string storyId, string edgeId)
	{
		if (storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && edgeId == "9ff4e676-c0fd-4f91-a409-0fe33c4b1096")
			return true;
		if (storyId == "4bc03f21-6d66-4574-b460-8acb7aee194e" && edgeId == "d91a0c84-1f27-4adf-9a8f-e8972918ea0f")
			return true;
		return true;
	}
}
