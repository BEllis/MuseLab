using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices.JavaScript;

namespace Foxoft.Ci
{
public static partial class TranspileLib
{
	[JSExport]
	public static string TranspileJs(string ciSource)
	{
		var parser = new CiParser();
		parser.Program = new CiProgram { Parent = CiSystem.Value };
		using var reader = new StringReader(ciSource);
		parser.Parse("input.ci", reader);
		new CiResolver(parser.Program, new List<string>(), "js");

		StringWriter captured = null;
		var gen = new GenJs
		{
			OutputFile = "output.js",
			CreateTextWriter = _ =>
			{
				captured = new StringWriter { NewLine = "\n" };
				return captured;
			},
		};
		gen.Write(parser.Program);
		if (captured == null)
			throw new InvalidOperationException("cito did not produce output");
		return captured.ToString();
	}
}

}
