import {
  BaseSource,
  Context,
  Item,
} from "https://deno.land/x/ddu_vim@v0.1.0/types.ts#^";
import { Denops, fn } from "https://deno.land/x/ddu_vim@v0.1.0/deps.ts#^";
import { ActionData } from "https://deno.land/x/ddu_kind_file@v0.1.0/file.ts#^";

type Params = Record<never, never>;

enum TYPE_DIAGNOSTICS {
  "Error",
  "Warning",
  "Information",
  "Hint",
}

export class Source extends BaseSource<Params> {
  kind = "file";

  gather(args: {
    denops: Denops;
    context: Context;
    sourceParams: Params;
  }): ReadableStream<Item<ActionData>[]> {
    return new ReadableStream({
      async start(controller) {
        const items = await args.denops.eval(
          `luaeval("require'lsp_ddu'.diagnostic_all()")`,
        ) as {
          lnum: number;
          col: number;
          bufnr: number;
          severity: number;
          message: string;
        }[] | null;
        if (items === null) {
          return controller.close();
        }
        controller.enqueue(
          await Promise.all(items.map(async (item, _) => {
            const bufname = await fn.bufname(args.denops, item.bufnr);
            return {
              word: `${bufname}:${item.lnum}:${item.col} ${item.message} [${
                TYPE_DIAGNOSTICS[item.severity]
              }]`,
              action: {
                path: bufname,
                lineNr: item.lnum + 1,
                col: item.col + 1,
                type: TYPE_DIAGNOSTICS[item.severity],
              },
            };
          })),
        );
      },
    });
  }
  params(): Params {
    return {
      path: "",
    };
  }
}
