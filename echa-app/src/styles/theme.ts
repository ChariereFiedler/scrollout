import { css } from 'lit';

export const theme = css`
  :host {
    --bg: #0a0a0a;
    --surface: #141414;
    --surface2: #1a1a1a;
    --surface3: #222;
    --border: #2a2a2a;
    --text: #fff;
    --text-dim: #888;
    --text-muted: #555;
    --accent: #3897f0;
    --green: #44b868;
    --yellow: #fdcb58;
    --orange: #f77737;
    --red: #ed4956;
    --purple: #c13584;
    --radius: 10px;
    --radius-sm: 6px;
  }
`;

export const polColors = ['#888', '#44b868', '#fdcb58', '#f77737', '#ed4956'];
export const polLabels = ['Apolitique', 'Social', 'Indirect', 'Explicite', 'Militant'];
