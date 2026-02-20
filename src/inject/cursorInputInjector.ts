import * as vscode from "vscode";
import { IInputInjector } from "../types/contracts";

export class CursorInputInjector implements IInputInjector {
  async insert(text: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const success = await editor.edit((editBuilder) => {
        editBuilder.replace(editor.selection, text);
      });
      if (success) {
        return;
      }
    }

    await vscode.env.clipboard.writeText(text);

    try {
      await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
    } catch {
      throw new Error(
        "No active editor and paste command unavailable."
      );
    }
  }
}
