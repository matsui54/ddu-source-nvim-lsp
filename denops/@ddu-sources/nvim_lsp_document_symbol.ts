import {
  BaseSource,
  Context,
  Item,
  SourceOptions,
} from "https://deno.land/x/ddu_vim@v2.0.0/types.ts";
import { Denops } from "https://deno.land/x/ddu_vim@v2.0.0/deps.ts";
import { ActionData } from "https://deno.land/x/ddu_kind_file@v0.3.2/file.ts";
import {
  DocumentSymbol,
  SymbolInformation,
  SymbolKind,
} from "npm:vscode-languageserver-types@3.17.2";

type Params = {
  kindLabels: Record<string, string>;
};

type Result = { result: DocumentSymbol[] | SymbolInformation[] | undefined };

type Symbols = Record<string, {
  item: Item<ActionData>;
  children: Symbols;
}>;

export class Source extends BaseSource<Params> {
  kind = "file";
  cache: Symbols = {};
  labels = Object.keys(SymbolKind);

  private async makeCache(
    denops: Denops,
    bufNr: number,
    winId: number,
    params: Params,
  ) {
    const results = await denops.call(
      "luaeval",
      "require'lsp_ddu'.document_symbol(_A.bufNr, _A.winId)",
      { bufNr, winId },
    ) as Result[] | null;
    if (!results) return;
    this.cache = this.makeSymbolTree(bufNr, "", results, params);
  }

  private makeSymbolTree(
    bufNr: number,
    parent: string,
    results: Result[] | undefined,
    params: Params,
  ): Symbols {
    if (!results) {
      return {};
    }
    const symbols: Symbols = {};
    for (const res of results) {
      if (!res.result) continue;
      for (const item of res.result) {
        const path = parent + (parent ? "/" : "") + item.name;
        const kindName = this.labels[item.kind - 1];
        let kindLabel = kindName;
        if (kindName in params.kindLabels) {
          kindLabel = params.kindLabels[kindName];
        }
        const word = `${kindLabel} ${item.name}`;
        if ("range" in item) {
          symbols[item.name] = {
            item: {
              word,
              action: {
                bufNr,
                lineNr: item.range.start.line + 1,
                col: item.range.start.character + 1,
              },
              isTree: item.children != undefined,
              treePath: path,
            },
            children: this.makeSymbolTree(bufNr, path, [{
              result: item.children,
            }], params),
          };
        } else {
          symbols[item.name] = {
            item: {
              word,
              action: {
                bufNr,
                lineNr: item.location.range.start.line + 1,
                col: item.location.range.start.character + 1,
              },
              isTree: false,
              treePath: path,
            },
            children: {},
          };
        }
      }
    }
    return symbols;
  }

  gather(args: {
    denops: Denops;
    context: Context;
    sourceParams: Params;
    sourceOptions: SourceOptions;
  }): ReadableStream<Item<ActionData>[]> {
    const start = async (
      controller: ReadableStreamDefaultController<Item<ActionData>[]>,
    ) => {
      const path = args.sourceOptions.path;
      const bufNr = args.context.bufNr;
      if (!path) {
        await this.makeCache(
          args.denops,
          bufNr,
          args.context.winId,
          args.sourceParams,
        );
      }
      let current = this.cache;
      for (const name of path.split("/")) {
        if (name) {
          current = current[name].children;
        }
      }
      const items = Object.values(current).map((v) => v.item).sort((a, b) => {
        const l0 = a.action?.lineNr ?? 0;
        const l1 = b.action?.lineNr ?? 0;
        return l0 - l1;
      });
      controller.enqueue(items);
      controller.close();
      return;
    };
    return new ReadableStream({ start });
  }
  params(): Params {
    return { kindLabels: {} };
  }
}
