import { previewParticipantsFromCsv, previewParticipantsFromPaste } from "../../src/services/participantImport";

describe("participantImport", () => {
  it("parses paste input with LF and CRLF while trimming whitespace", () => {
    const preview = previewParticipantsFromPaste(" 0027  \n0042,  Trần Văn B  \r\n\n 0043 ");

    expect(preview.received).toBe(3);
    expect(preview.valid).toHaveLength(3);
    expect(preview.valid.map((participant) => participant.code)).toEqual(["0027", "0042", "0043"]);
    expect(preview.valid[1]?.name).toBe("Trần Văn B");
    expect(preview.invalidRows).toHaveLength(0);
    expect(preview.duplicateRows).toHaveLength(0);
  });

  it("parses CSV input with a header row and quoted comma names", () => {
    const preview = previewParticipantsFromCsv('code,name\r\n0027,"Nguyễn, Văn A"\r\n0042,Trần Văn B');

    expect(preview.received).toBe(2);
    expect(preview.valid).toHaveLength(2);
    expect(preview.valid[0]?.code).toBe("0027");
    expect(preview.valid[0]?.name).toBe("Nguyễn, Văn A");
    expect(preview.invalidRows).toHaveLength(0);
    expect(preview.duplicateRows).toHaveLength(0);
  });

  it("parses CSV input without a header row", () => {
    const preview = previewParticipantsFromCsv("0027,Nguyễn Văn A\n0042,Trần Văn B");

    expect(preview.received).toBe(2);
    expect(preview.valid).toHaveLength(2);
    expect(preview.valid[1]?.code).toBe("0042");
  });

  it("reports malformed CSV rows as invalid", () => {
    const preview = previewParticipantsFromCsv("0027,Nguyễn Văn A,extra");

    expect(preview.received).toBe(1);
    expect(preview.valid).toHaveLength(0);
    expect(preview.invalidRows).toHaveLength(1);
    expect(preview.invalidRows[0]?.reason).toBe("malformed_row");
    expect(preview.invalidRows[0]?.sourceRow).toBe(1);
  });
});
