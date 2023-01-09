import {
  BaseSource,
  Context,
  Item,
  SourceOptions,
} from "https://deno.land/x/ddu_vim@v2.0.0/types.ts";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v2.0.0/deps.ts";
import { ActionData } from "https://deno.land/x/ddu_kind_file@v0.3.2/file.ts";
import {
  SymbolInformation,
  SymbolKind,
  WorkspaceSymbol,
} from "npm:vscode-languageserver-types@3.17.2";

type Params = {
  kindLabels: Record<string, string>;
};

type Result = { result: SymbolInformation[] | WorkspaceSymbol[] };

type Symbols = Record<string, {
  item: Item<ActionData>;
  children: Symbols;
}>;

export class Source extends BaseSource<Params> {
  kind = "file";
  cache: Symbols = {};
  labels = Object.keys(SymbolKind);

  gather(args: {
    denops: Denops;
    context: Context;
    sourceParams: Params;
    sourceOptions: SourceOptions;
  }): ReadableStream<Item<ActionData>[]> {
    const start = async (
      controller: ReadableStreamDefaultController<Item<ActionData>[]>,
    ) => {
      const bufNr = args.context.bufNr;
      const query = await fn.input(args.denops, "query: ");
      const results = await args.denops.call(
        "luaeval",
        "require'lsp_ddu'.workspace_symbol(_A.bufNr, _A.query)",
        { bufNr, query },
      ) as Result[] | null;
      console.log(results);
      if (!results) {
        controller.close();
        return;
      }
      let items: Item<ActionData>[] = [];
      for (const result of results) {
        for (const item of result.result) {
          items.push(
            {
              word: item.name,
              action: {
                path: item.location.uri,
                lineNr: (item.location.range?.start.line ?? 0) + 1,
                col: (item.location.range?.start.character ?? 0) + 1,
              },
            },
          );
        }
      }
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
