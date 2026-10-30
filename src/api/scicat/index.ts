import type { CatalogApi } from "@/api/types";
import { get } from "./client";

// The SciCat adapter. Each method names the endpoint it will use; the ones not yet written throw so a
// mis-configured build fails loudly instead of showing mock data. Fill them in against SciCat v4:
//
//   datasets.list / total   GET  /datasets?filter={where,limits}   (and /datasets/count for the bounded total)
//   datasets.search         GET  /datasets/fullquery?fields={"text":…}&limits={limit}
//   datasets.get            GET  /datasets/{pid}
//   datasets.related        GET  /datasets?filter={"where":{"inputDatasets":pid}}  +  the record's own inputDatasets
//   datasets.files          GET  /datasets/{pid}/origdatablocks
//   datasets.metaKeys       GET  /datasets/metadataKeys     (units and ranges need the measurement dictionary we discussed)
//   datasets.update/remove  PATCH/DELETE /datasets/{pid}
//   datasets.create         POST /datasets
//   datasets.publish        POST /publisheddata
//   datasets.requestRetrieval / requestDownload   POST /jobs  (type "retrieve" / "public")
//   samples.get             GET  /samples/{sampleId}  (sampleCharacteristics -> characteristics + groups)  +  datasets of that sample
//   proposals / samples / instruments / publisheddata / jobs    GET /{collection}, GET /{collection}/{id}
//   options.*               loaded once by `ready` from /instruments, /proposals, /samples; keywords need the
//                           keyword-stats endpoint, since /datasets/fullfacet scans the collection.
//
// DTOs differ from the UI's domain types (instrumentIds[], techniques[{pid,name}], datasetlifecycle), so each
// method maps through ./mappers before returning.

const todo = (endpoint: string) => (): never => {
  throw new Error(`SciCat adapter: ${endpoint} is not implemented yet`);
};

export const scicatApi: CatalogApi = {
  datasets: {
    list: todo("GET /datasets"),
    total: todo("GET /datasets/count"),
    search: todo("GET /datasets/fullquery"),
    get: (pid) => get(`/datasets/${encodeURIComponent(pid)}`).then(todo("mappers.dataset")),
    related: todo("GET /datasets?filter=inputDatasets"),
    files: todo("GET /datasets/{pid}/origdatablocks"),
    metaKeys: todo("GET /datasets/metadataKeys?search=&limit="),
    update: todo("PATCH /datasets/{pid}"),
    remove: todo("DELETE /datasets/{pid}"),
    restore: todo("POST /datasets"),
    create: todo("POST /datasets"),
    publish: todo("POST /publisheddata"),
    requestRetrieval: todo("POST /jobs"),
    requestDownload: todo("POST /jobs"),
  },
  proposals: { list: todo("GET /proposals"), get: todo("GET /proposals/{id}") },
  auth: { signIn: todo("POST /auth/login"), signOut: async () => {} },
  attachments: { list: todo("GET /datasets/{pid}/attachments"), add: todo("POST /datasets/{pid}/attachments"), update: todo("PATCH /datasets/{pid}/attachments/{id}"), remove: todo("DELETE /datasets/{pid}/attachments/{id}"), picture: todo("GET /datasets/{pid}/attachments/{id}"), setThumbnail: todo("PATCH /datasets/{pid}") },
  samples: { list: todo("GET /samples"), get: todo("GET /samples/{id} + GET /datasets?filter=sampleId") },
  instruments: { list: todo("GET /instruments") },
  published: { list: todo("GET /publisheddata") },
  jobs: { list: todo("GET /jobs"), retry: todo("POST /jobs") },
  options: {
    label: (_field, value) => value,
    facetValues: () => [],
    searchKeywords: todo("keyword stats endpoint"),
    proposals: () => [],
    instruments: () => [],
    samples: () => [],
  },
  ready: Promise.resolve(),
};
