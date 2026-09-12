import { z } from 'zod';

/** T070: Zod schemas for folder/document forms (US6). */
export const folderSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200),
  parent_id: z.string().uuid().optional().nullable(),
});
export type FolderInput = z.infer<typeof folderSchema>;
