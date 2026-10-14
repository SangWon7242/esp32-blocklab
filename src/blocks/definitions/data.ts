/** 변수 바꾸기·리스트 블록. 리스트 블록의 VAR 는 변수 칸(field_variable, 기본 items)이라 변수 이름 창과 이름 규칙을 그대로 쓴다 */

const listVar = { type: "field_variable", name: "VAR", variable: "items" };
const statement = { previousStatement: null, nextStatement: null, inputsInline: true };

export const dataBlocks: Record<string, unknown>[] = [
  {
    type: "var_change",
    message0: "%1 을(를) %2 만큼 바꾸기",
    args0: [
      { type: "field_variable", name: "VAR", variable: "count" },
      { type: "input_value", name: "DELTA", check: "Number" },
    ],
    ...statement,
    style: "variable_blocks",
    tooltip: "변수 += 수. 변수의 값에 수를 더합니다 (빼려면 음수).",
  },
  {
    type: "list_create",
    message0: "리스트 %1 만들기 (비어 있음)",
    args0: [listVar],
    ...statement,
    style: "list_blocks",
    tooltip: "리스트 = []. 항목이 없는 빈 리스트를 만듭니다.",
  },
  {
    type: "list_create_from",
    message0: "리스트 %1 을(를) %2 로 만들기",
    args0: [listVar, { type: "field_input", name: "ITEMS", text: "1, 2, 3" }],
    ...statement,
    style: "list_blocks",
    tooltip: "리스트 = [항목, 항목]. 쉼표로 나눈 항목으로 리스트를 만듭니다. 글자 항목은 \"red\" 처럼 따옴표로 감쌉니다.",
  },
  {
    type: "list_append",
    message0: "%1 에 %2 추가하기",
    args0: [listVar, { type: "input_value", name: "V" }],
    ...statement,
    style: "list_blocks",
    tooltip: "리스트.append(값). 리스트 맨 끝에 항목을 붙입니다.",
  },
  {
    type: "list_insert",
    message0: "%1 의 %2 번째에 %3 끼워 넣기 (0부터)",
    args0: [listVar, { type: "input_value", name: "I", check: "Number" }, { type: "input_value", name: "V" }],
    ...statement,
    style: "list_blocks",
    tooltip: "리스트.insert(번째, 값). 그 번째 자리에 넣고 뒤 항목은 한 칸씩 밀립니다. 첫 자리는 0 입니다.",
  },
  {
    type: "list_remove_at",
    message0: "%1 의 %2 번째 항목 지우기 (0부터)",
    args0: [listVar, { type: "input_value", name: "I", check: "Number" }],
    ...statement,
    style: "list_blocks",
    tooltip: "리스트.pop(번째). 그 번째 항목을 지웁니다. 첫 항목은 0 번입니다.",
  },
  {
    type: "list_remove_value",
    message0: "%1 에서 %2 지우기",
    args0: [listVar, { type: "input_value", name: "V" }],
    ...statement,
    style: "list_blocks",
    tooltip: "리스트.remove(값). 앞에서부터 처음 만나는 같은 값 하나를 지웁니다. 없으면 오류가 납니다.",
  },
  {
    type: "list_clear",
    message0: "%1 비우기",
    args0: [listVar],
    ...statement,
    style: "list_blocks",
    tooltip: "리스트.clear(). 리스트의 항목을 모두 지웁니다.",
  },
  {
    type: "list_set",
    message0: "%1 의 %2 번째 항목을 %3 로 정하기 (0부터)",
    args0: [listVar, { type: "input_value", name: "I", check: "Number" }, { type: "input_value", name: "V" }],
    ...statement,
    style: "list_blocks",
    tooltip: "리스트[번째] = 값. 그 번째 항목을 새 값으로 바꿉니다. 첫 항목은 0 번입니다.",
  },
  {
    type: "list_index",
    message0: "%1 에서 %2 의 위치 (0부터)",
    args0: [listVar, { type: "input_value", name: "V" }],
    inputsInline: true,
    output: "Number",
    style: "list_blocks",
    tooltip: "리스트.index(값). 값이 처음 나오는 번호입니다. 첫 항목은 0 번이고, 없으면 오류가 납니다.",
  },
];
