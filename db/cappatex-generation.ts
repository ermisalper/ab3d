/** Execute each group in a single D1 batch (a transaction). */
export const RESERVE_DESIGN = `INSERT INTO cappatex_designs
  (id,email,prompt,production_prompt,style,product_key,preview_base64,preview_format,status,created_at,updated_at,token_reserved)
  SELECT ?,?,?,?,?,?,'','png','generating',?,?,?
  WHERE EXISTS (SELECT 1 FROM accounts WHERE email = ? AND (token_balance >= 1 OR ? = 1))`;
export const DEBIT_DESIGN = "UPDATE accounts SET token_balance = token_balance - 1, updated_at = ? WHERE email = ? AND EXISTS (SELECT 1 FROM cappatex_designs WHERE id = ? AND token_reserved = 1)";
export const LOG_DESIGN = "INSERT INTO token_ledger (email,delta,reason,task_id,created_at) SELECT ?,-1,'CAPPATEX Motiv',?,? WHERE EXISTS (SELECT 1 FROM cappatex_designs WHERE id = ? AND token_reserved = 1)";
const REFUNDABLE = "SELECT 1 FROM cappatex_designs WHERE id = ? AND token_reserved = 1 AND token_refunded = 0 AND status = 'generating'";
export const REFUND_DESIGN = `UPDATE accounts SET token_balance = token_balance + 1 WHERE email = ? AND EXISTS (${REFUNDABLE})`;
export const LOG_REFUND = `INSERT INTO token_ledger (email,delta,reason,task_id,created_at) SELECT ?,1,'CAPPATEX Generierung fehlgeschlagen',?,? WHERE EXISTS (${REFUNDABLE})`;
export const FINISH_FAILURE = "UPDATE cappatex_designs SET status = ?, token_refunded = 1, updated_at = ? WHERE id = ? AND status = 'generating'";
