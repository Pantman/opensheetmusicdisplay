import { expect } from "chai";
import { OpenSheetMusicDisplay } from "../../../../src/OpenSheetMusicDisplay/OpenSheetMusicDisplay";
import { TestUtils } from "../../../Util/TestUtils";

describe("TAB source correctness regressions", () => {
    async function render(xml: string): Promise<{osmd: OpenSheetMusicDisplay, div: HTMLElement}> {
        const div: HTMLElement = TestUtils.getDivElement(document);
        const osmd: OpenSheetMusicDisplay = new OpenSheetMusicDisplay(div, {autoResize: false, backend: "svg"});
        await osmd.load(xml);
        osmd.render();
        expect(div.innerHTML).not.to.match(/NaN|Infinity/);
        return {osmd, div};
    }
    it("draws a dotted TAB note without changing its duration or dot count", async () => {
        const xml: string = `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Guitar</part-name>
        </score-part></part-list>
        <part id="P1"><measure number="1"><attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>TAB</sign><line>5</line></clef><staff-details><staff-lines>6</staff-lines></staff-details></attributes>
        <note><pitch><step>E</step><octave>3</octave></pitch><duration>3</duration><type>quarter</type><dot/>
        <notations><technical><string>4</string><fret>2</fret></technical></notations></note></measure></part></score-partwise>`;
        const {osmd, div} = await render(xml);
        try {
            const graphical: any = osmd.GraphicSheet.findGraphicalMeasure(0, 0).staffEntries[0].graphicalVoiceEntries[0].notes[0];
            const note: any = graphical.vfnote[0];
            expect(note.getModifiers().filter((m: any) => m.getCategory() === "dots")).to.have.length(1);
            expect(note.getDots()).to.equal(1);
            expect(graphical.sourceNote.Length.RealValue).to.equal(3 / 8);
        } finally { div.remove(); }
    });
    it("renders grace-boundary vibrato without an unformatted tick-context anchor", async () => {
        const {div} = await render(`<?xml version="1.0" encoding="UTF-8"?>
<!-- Original independent regression study; no third-party score material. -->
<score-partwise version="4.0">
  <work><work-title>Grace and vibrato anchors</work-title></work>
  <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>TAB</sign><line>5</line></clef></attributes>
      <note><grace slash="yes"/><pitch><step>C</step><octave>4</octave></pitch><voice>1</voice><type>eighth</type><notations><technical>
        <string>3</string><fret>5</fret></technical></notations></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>half</type><notations><ornaments>
        <wavy-line type="start"/></ornaments><technical><string>3</string><fret>7</fret></technical></notations></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>half</type><notations><ornaments>
        <wavy-line type="stop"/></ornaments><technical><string>3</string><fret>5</fret></technical></notations></note>
    </measure>
    <measure number="2">
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>half</type><notations><ornaments>
        <wavy-line type="start"/></ornaments><technical><string>3</string><fret>7</fret></technical></notations></note>
      <note><grace slash="yes"/><pitch><step>B</step><octave>3</octave></pitch><voice>1</voice><type>eighth</type><notations><technical>
        <string>3</string><fret>4</fret></technical></notations></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>half</type><notations><ornaments>
        <wavy-line type="stop"/></ornaments><technical><string>3</string><fret>5</fret></technical></notations></note>
    </measure>
  </part>
</score-partwise>
`);
        try { expect(div.querySelectorAll("svg path").length).to.be.greaterThan(0); }
        finally { div.remove(); }
    });
    it("renders cross-bar slides including a source-less courtesy measure", async () => {
        const {div} = await render(`<?xml version="1.0" encoding="UTF-8"?>
<!-- Original independent regression study; no third-party score material. -->
<score-partwise version="4.0">
  <work>
    <work-title>Cross-bar slide study</work-title>
  </work>
  <part-list>
    <score-part id="P1">
      <part-name>Electric Guitar</part-name>
      <midi-instrument id="I1">
        <midi-channel>1</midi-channel>
        <midi-program>30</midi-program>
      </midi-instrument>
    </score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions>
        <time>
          <beats>1</beats>
          <beat-type>4</beat-type>
        </time>
        <clef>
          <sign>TAB</sign>
          <line>5</line>
        </clef>
        <staff-details>
          <staff-lines>6</staff-lines>
        </staff-details>
      </attributes>
      <note>
        <pitch>
          <step>G</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>quarter</type>
        <notations>
          <slide type="start" number="3"/>
          <technical>
            <string>3</string>
            <fret>12</fret>
          </technical>
        </notations>
      </note>
    </measure>
    <measure number="2">
      <note>
        <pitch>
          <step>A</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>quarter</type>
        <notations>
          <slide type="stop" number="3"/>
          <technical>
            <string>3</string>
            <fret>14</fret>
          </technical>
        </notations>
      </note>
    </measure>
    <measure number="3">
      <note>
        <pitch>
          <step>A</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>quarter</type>
        <notations>
          <slide type="start" number="3"/>
          <slur type="start" number="3"/>
          <technical>
            <string>3</string>
            <fret>14</fret>
          </technical>
        </notations>
      </note>
    </measure>
    <measure number="4">
      <note>
        <pitch>
          <step>G</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>quarter</type>
        <notations>
          <slide type="stop" number="3"/>
          <slur type="stop" number="3"/>
          <technical>
            <string>3</string>
            <fret>12</fret>
          </technical>
        </notations>
      </note>
    </measure>
    <measure number="5">
      <note>
        <pitch>
          <step>C</step>
          <octave>4</octave>
        </pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>quarter</type>
        <notations>
          <slide type="start" number="3"/>
          <slur type="start" number="3"/>
          <technical>
            <string>3</string>
            <fret>5</fret>
          </technical>
        </notations>
      </note>
    </measure>
    <measure number="6">
      <note>
        <pitch>
          <step>C</step>
          <octave>5</octave>
        </pitch>
        <duration>1</duration>
        <voice>1</voice>
        <type>quarter</type>
        <notations>
          <slide type="stop" number="3"/>
          <slur type="stop" number="3"/>
          <technical>
            <string>3</string>
            <fret>17</fret>
          </technical>
        </notations>
      </note>
    </measure>
  </part>
</score-partwise>
`);
        try { expect(div.querySelectorAll("svg").length).to.be.greaterThan(0); }
        finally { div.remove(); }
    });
});
