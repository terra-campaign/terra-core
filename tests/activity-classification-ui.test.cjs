"use strict";

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const path =
  require("node:path");

const root =
  path.resolve(
    __dirname,
    ".."
  );

function read(file) {
  return fs
    .readFileSync(
      path.join(
        root,
        file
      ),
      "utf8"
    )
    .replace(/\r\n/g, "\n");
}

function optionValues(
  html,
  selectId
) {
  const start =
    html.indexOf(
      `id="${selectId}"`
    );

  assert.notEqual(
    start,
    -1
  );

  const open =
    html.lastIndexOf(
      "<select",
      start
    );

  const close =
    html.indexOf(
      "</select>",
      start
    );

  assert.ok(
    open >= 0
  );

  assert.ok(
    close > start
  );

  const block =
    html.slice(
      open,
      close
    );

  return [
    ...block.matchAll(
      /<option\s+value="([^"]*)"/g
    ),
  ].map(
    match =>
      match[1]
  );
}

function selectLabelBlock(
  html,
  selectId
) {
  const marker =
    `id="${selectId}"`;

  const pos =
    html.indexOf(
      marker
    );

  assert.notEqual(
    pos,
    -1
  );

  const open =
    html.lastIndexOf(
      "<label",
      pos
    );

  const close =
    html.indexOf(
      "</label>",
      pos
    );

  assert.ok(
    open >= 0
  );

  assert.ok(
    close > pos
  );

  return html.slice(
    open,
    close
  );
}

const missionCodes = [
  "",
  "TERRITORIAL_BRIGADE",
  "OPERATIONAL_ACCOMPANIMENT",
  "WALL_PAINTING",
  "EVENT_SUPPORT_LOGISTICS",
  "MATERIAL_DISTRIBUTION",
  "DIGITAL_ACTIVITY",
];

const eventCodes = [
  "",
  "EVENT_GENERAL_ATTENDANCE",
  "LOCAL_MEETING_ATTENDANCE",
];

test(
  "mission forms expose exactly the six mission classifications",
  () => {
    const normal =
      read(
        "misiones.html"
      );

    const leader =
      read(
        "direccion-misiones.html"
      );

    assert.deepEqual(
      optionValues(
        normal,
        "missionActivityCode"
      ),
      missionCodes
    );

    assert.deepEqual(
      optionValues(
        leader,
        "activityCode"
      ),
      missionCodes
    );

    assert.match(
      selectLabelBlock(
        normal,
        "missionActivityCode"
      ),
      /required/
    );

    assert.match(
      selectLabelBlock(
        leader,
        "activityCode"
      ),
      /required/
    );
  }
);

test(
  "event form exposes exactly the two attendance classifications",
  () => {
    const html =
      read(
        "eventos.html"
      );

    assert.deepEqual(
      optionValues(
        html,
        "eventActivityCode"
      ),
      eventCodes
    );

    assert.match(
      selectLabelBlock(
        html,
        "eventActivityCode"
      ),
      /required/
    );
  }
);

test(
  "classification controls do not display point values",
  () => {
    const mission =
      selectLabelBlock(
        read(
          "misiones.html"
        ),
        "missionActivityCode"
      );

    const leader =
      selectLabelBlock(
        read(
          "direccion-misiones.html"
        ),
        "activityCode"
      );

    const event =
      selectLabelBlock(
        read(
          "eventos.html"
        ),
        "eventActivityCode"
      );

    for (
      const block of
      [
        mission,
        leader,
        event
      ]
    ) {
      assert.doesNotMatch(
        block,
        /\b(?:30|22|20|18|16|14|12|6)\b/
      );

      assert.doesNotMatch(
        block,
        /points?|puntos?|pts\.?/i
      );
    }
  }
);

test(
  "new root mission clients send activityCode",
  () => {
    const mission =
      read(
        "misiones.js"
      );

    const leader =
      read(
        "direccion-misiones.js"
      );

    assert.match(
      mission,
      /activityCode:missionActivityCodeInput\.value/
    );

    assert.match(
      leader,
      /activityCode:\$\('activityCode'\)\.value/
    );
  }
);

test(
  "delegated mission does not send activityCode",
  () => {
    const mission =
      read(
        "misiones.js"
      );

    assert.match(
      mission,
      /parentMission \? \{\} : \{activityCode:missionActivityCodeInput\.value\}/
    );

    assert.match(
      mission,
      /missionActivityCodeField\.hidden = !!parent/
    );
  }
);

test(
  "general event creation sends activityCode",
  () => {
    const events =
      read(
        "eventos.js"
      );

    assert.match(
      events,
      /activityCode:\s*\$\("eventActivityCode"\)\s*\.value/
    );
  }
);

test(
  "event delegation payload remains classification-free",
  () => {
    const events =
      read(
        "eventos.js"
      );

    const parentField =
      events.indexOf(
        "parentInvitationId:"
      );

    assert.notEqual(
      parentField,
      -1
    );

    const selectedValue =
      events.indexOf(
        "selectedInvitationId",
        parentField
      );

    assert.ok(
      selectedValue >
        parentField
    );

    const payloadStart =
      events.lastIndexOf(
        "const payload",
        parentField
      );

    const payloadEnd =
      events.indexOf(
        "const fingerprint",
        parentField
      );

    assert.ok(
      payloadStart >= 0
    );

    assert.ok(
      payloadEnd >
        selectedValue
    );

    const payload =
      events.slice(
        payloadStart,
        payloadEnd
      );

    assert.match(
      payload,
      /parentInvitationId:\s*selectedInvitationId/
    );

    assert.match(
      payload,
      /assigneeIds/
    );

    assert.doesNotMatch(
      payload,
      /activityCode/
    );
  }
);

test(
  "growth classification is absent from mission and event forms",
  () => {
    const html =
      [
        read(
          "misiones.html"
        ),
        read(
          "direccion-misiones.html"
        ),
        read(
          "eventos.html"
        ),
      ].join("\n");

    assert.doesNotMatch(
      html,
      /ORGANIZATIONAL_GROWTH/
    );
  }
);

test(
  "modified clients use explicit cache versions",
  () => {
    assert.match(
      read(
        "misiones.html"
      ),
      /misiones\.js\?v=build-124-a4-b1b-001/
    );

    assert.match(
      read(
        "direccion-misiones.html"
      ),
      /direccion-misiones\.js\?v=build-124-a4-b1b-001/
    );

    assert.match(
      read(
        "eventos.html"
      ),
      /eventos\.js\?v=build-124-a4-b1b-001/
    );
  }
);
