const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');

const js=fs.readFileSync(
  path.join(root,'direccion.js'),
  'utf8'
);

const html=fs.readFileSync(
  path.join(root,'direccion.html'),
  'utf8'
);

test(
  'direction permits active principal leader role',
  ()=>{
    assert.match(
      js,
      /!\['admin','lider_principal'\]\.includes\(p\.role\)/
    );
  }
);

test(
  'principal leader cannot see admin setup section',
  ()=>{
    assert.match(
      js,
      /\$\('setup'\)\.hidden=p\.role!=='admin'/
    );

    assert.match(
      html,
      /<section id="setup" hidden>/
    );
  }
);

test(
  'principal leader cannot see admin campaign supervision selector',
  ()=>{
    assert.match(
      js,
      /\$\('panelCampaignControl'\)\.hidden=p\.role!=='admin'/
    );

    assert.match(
      html,
      /<section id="panelCampaignControl" hidden>/
    );
  }
);

test(
  'principal leader does not load admin authorized campaign list',
  ()=>{
    assert.match(
      js,
      /if\(p\.role==='admin'\)\{const available=await loadAdminCampaigns\(\)/
    );
  }
);

test(
  'principal leader panel request cannot send admin selected campaign',
  ()=>{
    assert.match(
      js,
      /currentRole==='admin' && currentPanelCampaignId/
    );

    assert.match(
      js,
      /\? \{campaignId:currentPanelCampaignId\}\s*:\s*\{\}/
    );
  }
);

test(
  'principal leader sees leader operational sections',
  ()=>{
    assert.match(
      js,
      /\$\('leaderMissions'\)\.hidden=p\.role!=='lider_principal'/
    );

    assert.match(
      js,
      /\$\('leaderEvents'\)\.hidden=p\.role!=='lider_principal'/
    );
  }
);

test(
  'create campaign handler refuses non admin role',
  ()=>{
    const match=
      js.match(
        /\$\('createCampaignForm'\)\.onsubmit=async e=>\{([\s\S]*?)\n\};/
      );

    assert.ok(
      match,
      'No se encontro createCampaignForm.'
    );

    assert.match(
      match[1],
      /if\(currentRole!=='admin'\)return;/
    );
  }
);

test(
  'leader assignment form remains inside hidden admin setup',
  ()=>{
    const setupStart=
      html.indexOf(
        '<section id="setup" hidden>'
      );

    const assignForm=
      html.indexOf(
        '<form id="assign">'
      );

    assert.ok(
      setupStart>=0,
      'No se encontro setup.'
    );

    assert.ok(
      assignForm>setupStart,
      'El formulario assign no esta dentro del setup administrativo.'
    );
  }
);

console.log(
  'OK: BUILD-123D4G-H10B principal leader frontend role contract passed.'
);
