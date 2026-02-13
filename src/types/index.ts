export type PatientType = 'PSY' | 'MED';

export type Attachment = {
  url: string;
  // img: imagen embebible, pdf: visor, audio: reproducción, file: genérico
  type: 'img' | 'pdf' | 'audio' | 'file';
  name: string;
};

export type CreatePatientResult =
  | { success: true; newId: string }
  | { success: false; error: string };

export type SaveNoteResult =
  | { success: true }
  | { success: false; error: string };
