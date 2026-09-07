from pathlib import Path
import re
p = Path('firestore.rules')
s = p.read_text()
marker = 'function missionAcceptsEvidence()'
if marker in s:
    print('La protección de misiones desactivadas ya está instalada.')
    raise SystemExit(0)
start = s.index('match /missionEvidence/{evidenceId} {')
# Match this block with balanced braces, without touching other collections.
opening = s.index('{', start + len('match /missionEvidence/{evidenceId}'))
depth = 1
end = opening + 1
while depth:
    if s[end] == '{': depth += 1
    if s[end] == '}': depth -= 1
    end += 1
block = s[opening + 1:end - 1]
block, count = re.subn(r'allow create:\s*if\s*', 'allow create: if missionAcceptsEvidence() && ', block)
if count != 3:
    raise SystemExit('No se modificó nada: se esperaban tres reglas de creación de evidencia. Comparte firestore.rules para adaptarlo.')
helper = '''
      function missionAcceptsEvidence() {
        return exists(/databases/$(database)/documents/misiones/$(request.resource.data.missionId)) &&
          get(/databases/$(database)/documents/misiones/$(request.resource.data.missionId)).data.active == true;
      }
'''
backup = Path('firestore.rules.antes-vigencia')
if backup.exists():
    raise SystemExit('Ya existe el respaldo; no se modificó nada.')
backup.write_text(s)
p.write_text(s[:opening+1] + helper + block + s[end-1:])
print('Protección aplicada a las tres reglas. Respaldo: firestore.rules.antes-vigencia')
