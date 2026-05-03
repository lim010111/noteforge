1. 댓글 기능(은 나중에)

---

1. 개요(Table of Contents) 기능

---

블로그 글에서 Table of Contents 기능을 구현해야 돼.

`docs/references/table_of_contents/` 폴더 안에 Reference들이 있으니, 그걸 바탕으로 해당 기능을 구현해.

디자인은 웬만하면 HTML의 Table of Contents와 동일하게 구현하도록 해. 


---

- `body > div > div.site-shell__toc > aside > nav > h2` 이거 폰트 `Noto Sans KR`로 변경해.
- 사이드바와 목차의 크기가 전체 페이지에 비교해서 너무 커보여. 특히 사이드바는 너무 커. 사이드바의 크기를 조금 줄이고 목차도 살짝만 줄여.

---

- `note-toc`의 크기를 절반으로 줄여.
- 카테고리의 폰트 등의 크기를 줄여.ㅁ


---

---

- `nav.folder-tree`가 없을 때, 즉 페이지의 크기가 축소되어 사이드바가 반응형으로 사라질 때는 `site-header__inner`와 `main.site-main`이 column-wise로 딱 정렬되어있는데, 사이드바가 등장하면 그 정렬이 깨져. 페이지의 크기와 상관없이 무조건 column wise로 정렬될 수 있게 만들어. 