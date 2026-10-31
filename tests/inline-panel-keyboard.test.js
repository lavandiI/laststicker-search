const { setupKeyboardNavigation, isEditableElement } = require('../inline-panel');

function buildDom() {
  document.body.innerHTML = `
    <input id="search" type="search">
    <div id="results">
      <div class="ls-result-item" id="ls-result-0"></div>
      <div class="ls-result-item" id="ls-result-1"></div>
    </div>
  `;

  return {
    input: document.getElementById('search'),
    results: document.getElementById('results'),
  };
}

describe('search keyboard navigation', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('selects results with arrows and opens the active one with Enter', () => {
    const { input, results } = buildDom();
    const onOpen = jest.fn();
    setupKeyboardNavigation(input, results, onOpen);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.getElementById('ls-result-0').classList.contains('ls-result-item--active')).toBe(
      true,
    );
    expect(input.getAttribute('aria-activedescendant')).toBe('ls-result-0');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.getElementById('ls-result-1').classList.contains('ls-result-item--active')).toBe(
      true,
    );

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onOpen).toHaveBeenCalledWith(document.getElementById('ls-result-1'));
  });

  test('opens the first result with Enter when nothing is selected', () => {
    const { input, results } = buildDom();
    const onOpen = jest.fn();
    setupKeyboardNavigation(input, results, onOpen);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onOpen).toHaveBeenCalledWith(document.getElementById('ls-result-0'));
  });

  test('Escape clears the query and notifies listeners', () => {
    const { input, results } = buildDom();
    const onInput = jest.fn();
    input.value = 'обмен';
    input.addEventListener('input', onInput);
    setupKeyboardNavigation(input, results);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(input.value).toBe('');
    expect(onInput).toHaveBeenCalled();
  });

  test('slash focuses the search input', () => {
    const { input, results } = buildDom();
    setupKeyboardNavigation(input, results);

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));

    expect(document.activeElement).toBe(input);
  });

  test('Ctrl+K focuses the search input', () => {
    const { input, results } = buildDom();
    setupKeyboardNavigation(input, results);

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        code: 'KeyK',
        ctrlKey: true,
        bubbles: true,
      }),
    );

    expect(document.activeElement).toBe(input);
  });

  test('reset clears the active result', () => {
    const { input, results } = buildDom();
    const controller = setupKeyboardNavigation(input, results);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    controller.reset();

    expect(document.getElementById('ls-result-0').classList.contains('ls-result-item--active')).toBe(
      false,
    );
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
  });

  test('detects editable elements', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const div = document.createElement('div');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');

    expect(isEditableElement(input)).toBe(true);
    expect(isEditableElement(textarea)).toBe(true);
    expect(isEditableElement(div)).toBe(false);
    expect(isEditableElement(editable)).toBe(true);
    expect(isEditableElement(null)).toBe(false);
  });
});
