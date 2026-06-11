using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices.JavaScript;

namespace Foxoft.Ci
{
public static partial class TranspileLib
{
	static string Transpile(string ciSource, string lang, GenBase gen)
	{
		var parser = new CiParser();
		parser.Program = new CiProgram { Parent = CiSystem.Value };
		using var reader = new StringReader(ciSource);
		parser.Parse("input.ci", reader);
		new CiResolver(parser.Program, new List<string>(), lang);

		StringWriter captured = null;
		gen.CreateTextWriter = _ =>
		{
			captured = new StringWriter { NewLine = "\n" };
			return captured;
		};
		gen.Write(parser.Program);
		if (captured == null)
			throw new InvalidOperationException("cito did not produce output");
		return captured.ToString();
	}

	[JSExport]
	public static string TranspileJs(string ciSource)
	{
		return Transpile(ciSource, "js", new GenJs { OutputFile = "output.js" });
	}

	[JSExport]
	public static string TranspileCs(string ciSource)
	{
		return Transpile(ciSource, "cs", new GenCs { OutputFile = "output.cs" });
	}

	[JSExport]
	public static string TranspilePy(string ciSource)
	{
		return Transpile(ciSource, "py", new GenPy { OutputFile = "output.py" });
	}

	[JSExport]
	public static string TranspileJava(string ciSource)
	{
		return Transpile(ciSource, "java", new GenJava { OutputFile = "MuseLabEngine.java" });
	}
}

}
