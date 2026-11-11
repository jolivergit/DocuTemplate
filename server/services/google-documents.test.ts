import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { docs_v1, drive_v3 } from "googleapis";
import { parseTemplate, generateDocument } from "./doc-generation";
import { importHtmlContent } from "./google-docs";

test("selected template is read, copied, and only the new document is edited", async () => {
  const reads: string[] = [];
  const edits: string[] = [];
  const copies: string[] = [];
  const docs = { documents: {
    get: async ({ documentId }: { documentId: string }) => {
      reads.push(documentId);
      return { data: { title: "Selected template", body: { content: [
        { paragraph: { elements: [{ textRun: { content: "{{project_name}}\n" } }] } },
      ] } } };
    },
    batchUpdate: async ({ documentId, requestBody }: { documentId: string; requestBody: { requests: unknown[] } }) => {
      edits.push(documentId);
      assert.match(JSON.stringify(requestBody), /Studio test project/);
      return { data: {} };
    },
  } } as unknown as docs_v1.Docs;
  const drive = { files: {
    copy: async ({ fileId }: { fileId: string }) => {
      copies.push(fileId);
      return { data: { id: "app-created-copy" } };
    },
  } } as unknown as drive_v3.Drive;
  const template = await parseTemplate("picker-selected-template", docs);
  assert.equal(template.allTags[0].name, "project_name");
  const generated = await generateDocument("unused-test-user", {
    templateId: template.documentId,
    templateName: template.documentName,
    outputName: "Test document",
    tagMappings: [{ tagName: "project_name", tagType: "field", customContent: "Studio test project" }],
    sectionOrder: [],
  }, docs, drive);
  assert.deepEqual(reads, ["picker-selected-template"]);
  assert.deepEqual(copies, ["picker-selected-template"]);
  assert.deepEqual(edits, ["app-created-copy"]);
  assert.equal(generated.documentUrl, "https://docs.google.com/document/d/app-created-copy/edit");
});

for (const fail of [false, true]) {
  test(`HTML import cleans up its own temporary file ${fail ? "after an error" : "after success"}`, async () => {
    const deleted: string[] = [];
    const created: string[] = [];
    const edited: string[] = [];
    const drive = { files: {
      create: async ({ requestBody }: { requestBody: { mimeType: string } }) => {
        created.push(requestBody.mimeType);
        return { data: { id: "app-created-temp" } };
      },
      delete: async ({ fileId }: { fileId: string }) => { deleted.push(fileId); return { data: {} }; },
    } } as unknown as drive_v3.Drive;
    const docs = { documents: {
      get: async ({ documentId }: { documentId: string }) => {
        assert.equal(documentId, "app-created-temp");
        return { data: { body: { content: [
          { paragraph: { elements: [{ textRun: { content: "Imported text\n", textStyle: { bold: true } } }] } },
        ] } } };
      },
      batchUpdate: async ({ documentId }: { documentId: string }) => {
        edited.push(documentId);
        if (fail) throw new Error("simulated Google failure");
        return { data: {} };
      },
    } } as unknown as docs_v1.Docs;
    const result = importHtmlContent(drive, docs, "<b>Imported text</b>", "app-created-output", 1);
    if (fail) await assert.rejects(result, /simulated Google failure/);
    else assert.ok((await result).insertedLength > 0);
    assert.deepEqual(created, ["application/vnd.google-apps.document"]);
    assert.deepEqual(deleted, ["app-created-temp"]);
    assert.ok(edited.every(id => id === "app-created-output"));
  });
}
