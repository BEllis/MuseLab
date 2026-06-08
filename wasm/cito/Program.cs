using System;
using Foxoft.Ci;

public static class Program
{
	public static void Main()
	{
	}

	public static string TranspileJs(string ciSource)
	{
		try
		{
			return TranspileLib.TranspileJs(ciSource);
		}
		catch (CiException ex)
		{
			throw new Exception($"{ex.Filename}({ex.Line}): {ex.Message}");
		}
	}
}
