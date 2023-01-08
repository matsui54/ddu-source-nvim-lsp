local lsp = vim.lsp

local M = {}

local function get_available_client(method)
  for id, client in pairs(lsp.buf_get_clients()) do
    if client['resolved_capabilities'][method] ~= nil then
      return id
    end
  end
  return 0
end

function M.references()
  local params = lsp.util.make_position_params()
  params.context = { includeDeclaration = true }

  local results_lsp = lsp.buf_request_sync(0, "textDocument/references", params, 1000)
  local locations = {}
  for _, server_results in pairs(results_lsp) do
    if server_results.result ~= nil then
      vim.list_extend(locations, lsp.util.locations_to_items(server_results.result) or {})
    end
  end

  if vim.tbl_isempty(locations) then
    return nil
  end

  return locations
end

function M.document_symbol(bufnr, winid)
  local params = vim.lsp.util.make_position_params(winid)
  local res, reason = vim.lsp.buf_request_sync(bufnr, 'textDocument/documentSymbol', params, 1000)
  if res == nil then
    return nil
  end
  local all = {}
  for _, v in pairs(res) do
    table.insert(all, v)
  end
  return all
end

function M.workspace_symbol(query)
  local params = { workspace = lsp.util.make_workspace_params(), query = query }
  local raw_result = lsp.buf_request_sync(0, 'workspace/symbol', params, 1000)
  local client_id = get_available_client('workspace_symbol')
  if client_id == 0 or raw_result == nil then
    return nil
  end
  local result = lsp.util.symbols_to_items(raw_result[client_id].result, 0)
  return result
end

function M.diagnostic_buffer()
  local res = vim.diagnostic.get(0)
  if res == nil then
    return nil
  end
  return res
end

function M.diagnostic_all()
  local res = vim.diagnostic.get(nil)
  if res == nil then
    return nil
  end
  return res
end

return M
