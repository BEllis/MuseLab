export type MenuItem =
  | { type: "separator" }
  | { type: "header"; label: string }
  | {
      type?: "item";
      label: string;
      shortcut?: string;
      disabled?: boolean;
      checked?: boolean;
      action?: () => void | Promise<void>;
      submenu?: MenuItem[];
    };

export type MenuDef = {
  label: string;
  items: MenuItem[];
};
