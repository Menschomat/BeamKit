import { z } from 'zod';
import { writeFileSync } from 'node:fs';
import { designSchema } from '../src/domain/project.ts';
import { projectSchema } from '../src/project.ts';
writeFileSync('public/project.schema.json', JSON.stringify(z.toJSONSchema(designSchema), null, 2) + '\n');
writeFileSync('public/legacy-grid.schema.json', JSON.stringify(z.toJSONSchema(projectSchema), null, 2) + '\n');
