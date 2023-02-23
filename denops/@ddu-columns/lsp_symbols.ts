import {
  BaseColumn,
  DduItem,
  ItemHighlight,
} from "https://deno.land/x/ddu_vim@v2.1.0/types.ts";
import { GetTextResult } from "https://deno.land/x/ddu_vim@v2.1.0/base/column.ts";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v2.1.0/deps.ts";
import { ItemData } from "../@ddu-sources/nvim_lsp_document_symbol.ts";
import { SymbolKind } from "npm:vscode-languageserver-types@3.17.2";

type Params = {
  collapsedIcon: string;
  expandedIcon: string;
  iconWidth: number;
  indentWidth: number;
  kindLabels: Record<string, string | [string, string]>;
};

function strBytes(str: string): number {
  return (new TextEncoder().encode(str)).length;
}

export class Column extends BaseColumn<Params> {
  labels = Object.keys(SymbolKind);

  override async getLength(args: {
    denops: Denops;
    columnParams: Params;
    items: DduItem[];
  }): Promise<number> {
    const widths = await Promise.all(args.items.map(
      async (item) => {
        return item.__level * args.columnParams.indentWidth + 1 +
          args.columnParams.iconWidth +
          (await fn.strwidth(args.denops, item.word) as number) + 10;
      },
    )) as number[];
    return Math.max(...widths);
  }

  override getText(args: {
    columnParams: Params;
    startCol: number;
    endCol: number;
    item: DduItem;
  }): Promise<GetTextResult> {
    const isTree = args.item.isTree ?? false;
    const action = args.item.action as ItemData;
    const params = args.columnParams;

    const icon = isTree
      ? (args.item.__expanded
        ? args.columnParams.expandedIcon
        : args.columnParams.collapsedIcon)
      : " ";
    const prefix = icon + " ";
    const indentWidth = args.columnParams.indentWidth * args.item.__level;
    const kindName = this.labels[action.kind - 1];
    let kindLabel = kindName;
    let highlights: undefined | ItemHighlight[];
    if (kindName in params.kindLabels) {
      const label = params.kindLabels[kindName];
      if (typeof label == "string") {
        kindLabel = label;
      } else {
        kindLabel = label[0];
        highlights = [{
          name: "ddu-nvim-lsp-hl",
          "hl_group": label[1],
          col: indentWidth + strBytes(prefix) + 1,
          width: strBytes(kindLabel),
        }];
      }
    }
    const text = " ".repeat(indentWidth) +
      prefix + kindLabel + " " + args.item.word;
    const width = strBytes(text);
    const padding = " ".repeat(args.endCol - args.startCol - width);

    return Promise.resolve({
      text: text + padding,
      highlights,
    });
  }

  override params(): Params {
    return {
      collapsedIcon: "+",
      expandedIcon: "-",
      iconWidth: 1,
      indentWidth: 4,
      kindLabels: {},
    };
  }
}
