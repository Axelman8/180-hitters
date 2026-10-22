def enter_total(page, score):
    for _ in range(3):
        page.locator('#backspace').click()
    for digit in str(score):
        page.locator('#keypad').get_by_role('button', name=digit, exact=True).click()
