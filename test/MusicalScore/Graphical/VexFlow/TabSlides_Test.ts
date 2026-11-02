import { expect } from "chai";
import { OpenSheetMusicDisplay } from "../../../../src/OpenSheetMusicDisplay/OpenSheetMusicDisplay";
import { TestUtils } from "../../../Util/TestUtils";

describe("TAB slide and straight-doit instructions", () => {
    let div: HTMLElement;
    afterEach(() => { div?.remove(); });
    async function render(xml: string): Promise<OpenSheetMusicDisplay> {
        div = TestUtils.getDivElement(document);
        div.style.width = "1400px";
        const osmd: OpenSheetMusicDisplay = new OpenSheetMusicDisplay(div, {autoResize: false, backend: "svg", newSystemFromXML: true});
        await osmd.load(xml);
        osmd.render();
        expect(div.innerHTML).not.to.match(/NaN|Infinity/);
        return osmd;
    }
    function score(notes: string, divisions: number = 1): string {
        return `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
        <part id="P1"><measure number="1"><attributes><divisions>${divisions}</divisions><time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>TAB</sign><line>5</line></clef><staff-details><staff-lines>6</staff-lines></staff-details></attributes>
        ${notes}</measure></part></score-partwise>`;
    }
    function slidingNote(fret: number, marker: string, doit: boolean = false): string {
        return `<note><pitch><step>E</step><octave>3</octave></pitch><duration>1</duration><type>quarter</type>
        <notations><slur type="${marker}" number="1"/><slide type="${marker}" number="1" line-type="dashed"/>
        ${doit ? '<articulations><doit line-shape="straight"/></articulations>' : ""}
        <technical><string>3</string><fret>${fret}</fret></technical></notations></note>`;
    }
    it("retains parsed slide markers and paints a paired slide independently of a slur", async () => {
        const osmd: OpenSheetMusicDisplay = await render(score(slidingNote(12, "start") + slidingNote(14, "stop")));
        expect(div.querySelectorAll(".vf-tab-slide")).to.have.length(1);
        const source: any = osmd.GraphicSheet.findGraphicalMeasure(0, 0).staffEntries[0].graphicalVoiceEntries[0].notes[0].sourceNote;
        expect(source.TabSlides).to.deep.equal([{type: "start", number: "1", lineType: "dashed"}]);
    });
    it("renders a straight doit without adding another source note", async () => {
        const osmd: OpenSheetMusicDisplay = await render(score(slidingNote(12, "start", true)));
        expect(div.querySelectorAll(".vf-tab-doit")).to.have.length(1);
        expect(osmd.GraphicSheet.findGraphicalMeasure(0, 0).staffEntries).to.have.length(1);
    });
    it("honors dashed native slides when no simultaneous slur is present", async () => {
        const notes: string = (slidingNote(12, "start") + slidingNote(14, "stop"))
            .replace(/<slur[^>]*\/>/g, "").replace('type="stop" number="1" line-type="dashed"', 'type="stop" number="1"');
        const osmd: OpenSheetMusicDisplay = await render(score(notes));
        function verify(): void {
            const paths: Element[] = Array.from(div.querySelectorAll("path"));
            expect(paths.filter(path => path.getAttribute("stroke-dasharray")?.replace(/\s/g, "") === "3,3")).to.have.length(1);
            expect(div.querySelectorAll(".vf-tab-slide")).to.have.length(0); // native renderer owns this slide
        }
        verify();
        osmd.render();
        verify();
    });
    it("draws straight doits on individual chord strings", async () => {
        const notes: string = slidingNote(12, "start", true) + slidingNote(14, "start", true)
            .replace("<note>", "<note><chord/>").replace("<string>3</string>", "<string>2</string>");
        await render(score(notes));
        expect(div.querySelectorAll(".vf-tab-doit")).to.have.length(2);
    });

    it("keeps native slides dashed across a system break", async () => {
        const first: string = slidingNote(12, "start").replace(/<slur[^>]*\/>/g, "")
            .replace("<duration>1</duration>", "<duration>4</duration>").replace("<type>quarter</type>", "<type>whole</type>");
        const last: string = slidingNote(14, "stop").replace(/<slur[^>]*\/>/g, "")
            .replace("<duration>1</duration>", "<duration>4</duration>").replace("<type>quarter</type>", "<type>whole</type>");
        const xml: string = score(first)
            .replace("</measure></part>", `</measure><measure number="2"><print new-system="yes"/>${last}</measure></part>`);
        const osmd: OpenSheetMusicDisplay = await render(xml);
        const firstMeasure: any = osmd.GraphicSheet.findGraphicalMeasure(0, 0);
        const lastMeasure: any = osmd.GraphicSheet.findGraphicalMeasure(1, 0);
        expect(firstMeasure.ParentStaffLine === lastMeasure.ParentStaffLine).to.equal(false);
        const dashed: Element[] = Array.from(div.querySelectorAll("path")).filter(path =>
            path.getAttribute("stroke-dasharray")?.replace(/\s/g, "") === "3,3");
        expect(dashed).to.have.length(2);
    });
    it("anchors native chord slides to the marked string", async () => {
        const chord: (fret: number, marker: string) => string = (fret, marker) =>
            slidingNote(fret, marker).replace(/<slur[^>]*\/>/g, "").replace("<string>3</string>", "<string>2</string>") +
            slidingNote(fret + 2, marker).replace(/<slur[^>]*\/>/g, "").replace('number="1"', 'number="2"')
                .replace("<step>E</step>", "<step>G</step>")
                .replace("<note>", "<note><chord/>");
        const osmd: OpenSheetMusicDisplay = await render(score(chord(12, "start") + chord(14, "stop")));
        const entry: any = osmd.GraphicSheet.findGraphicalMeasure(0, 0).staffEntries[0].graphicalVoiceEntries[0];
        expect(entry.notes).to.have.length(2);
        const measure: any = osmd.GraphicSheet.findGraphicalMeasure(0, 0);
        const slides: any[] = Array.from(new Set(measure.vfTies));
        expect(slides).to.have.length(2);
        expect(slides.map(slide => slide.first_indices[0]).sort()).to.deep.equal([0, 1]);
        expect(slides.map(slide => slide.last_indices[0]).sort()).to.deep.equal([0, 1]);
    });

});
