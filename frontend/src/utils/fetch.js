/**
 * Collect ALL pages of a DRF paginated list endpoint by following `next`.
 * Use ONLY for dropdown/selector sources where you need the full set —
 * never for the main data table (use Pagination there instead).
 *
 * The backend (DRF PageNumberPagination, PAGE_SIZE=25) ignores client
 * `page_size`, so we must walk the pages.
 *
 * @param {Function} listFn - e.g. customersApi.list
 * @param {Object} params - extra query params
 * @returns {Promise<Array>} all results concatenated
 */
export async function collectAll(listFn, params = {}) {
  let page = 1;
  let all = [];
  let next = true;
  while (next) {
    // eslint-disable-next-line no-await-in-loop
    const res = await listFn({ ...params, page });
    const data = res.data;
    const results = Array.isArray(data) ? data : data.results ?? [];
    all = all.concat(results);
    next = !!data.next;
    page += 1;
    if (page > 500) break; // hard safety cap
  }
  return all;
}
