import { expect } from "chai";
import { OpenSheetMusicDisplay } from "../../../../src/OpenSheetMusicDisplay/OpenSheetMusicDisplay";
import { TestUtils } from "../../../Util/TestUtils";

describe("TAB sustain after hammer-on or pull-off", () => {
    let div: HTMLElement;
    afterEach(() => { div?.remove(); });
    async function render(xml: string): Promise<OpenSheetMusicDisplay> {
        div = TestUtils.getDivElement(document);
        div.style.width = "1400px";
        const osmd: OpenSheetMusicDisplay = new OpenSheetMusicDisplay(div, {autoResize: false, backend: "svg"});
        await osmd.load(xml);
        osmd.render();
        expect(div.innerHTML).not.to.match(/NaN|Infinity/);
        return osmd;
    }
    function score(notes: string, divisions: number = 1): string {
        return `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
        <part id="P1"><measure number="1"><attributes><divisions>${divisions}</divisions><time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>TAB</sign><line>5</line></clef><staff-details><staff-lines>6</staff-lines></staff-details></attributes>${notes}</measure></part></score-partwise>`;
    }
    function connected(kind: string): string {
        return score(`<note><pitch><step>E</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type>
            <notations><technical><${kind} type="start" number="1"/><string>4</string><fret>2</fret></technical></notations></note>
            <note><pitch><step>F</step><octave>3</octave></pitch><duration>1</duration><tie type="start"/><type>quarter</type>
            <notations><tied type="start"/><technical><${kind} type="stop" number="1"/><string>4</string><fret>3</fret></technical></notations></note>
            <note><pitch><step>F</step><octave>3</octave></pitch><duration>2</duration><tie type="stop"/><type>half</type>
            <notations><tied type="stop"/><technical><string>4</string><fret>3</fret></technical></notations></note>`);
    }
    for (const kind of ["hammer-on", "pull-off"]) {
        it(`retains the outgoing sustain at a ${kind} endpoint without duplicating it on reflow`, async () => {
            const osmd: OpenSheetMusicDisplay = await render(connected(kind));
            const read = (): any[] => osmd.GraphicSheet.findGraphicalMeasure(0, 0).staffEntries.flatMap((entry: any) => entry.GraphicalTies);
            const first: any[] = read();
            expect(first.filter((tie: any) => tie.Tie.Type === "")).to.have.length(1);
            expect(first.filter((tie: any) => tie.Tie.Type !== "")).to.have.length(1);
            osmd.render();
            expect(read().filter((tie: any) => tie.Tie.Type === "")).to.have.length(1);
        });
    }
});
