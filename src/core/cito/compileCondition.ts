import { hashId } from "./hashId";
import { museLabRuntimeCi } from "../../cito/ciSources";

export type CompiledCondition = {
  className: string;
  ciSource: string;
};

export function compileCondition(condition: string): CompiledCondition {
  const trimmed = condition.trim();
  const className = hashId(trimmed, "Condition");
  const generated = `
public static class ${className}
{
    public static bool Eval(MuseLabRuntime rt)
    {
        return ${trimmed};
    }
}
`;

  return {
    className,
    ciSource: `${museLabRuntimeCi.trim()}\n\n${generated.trim()}\n`,
  };
}
