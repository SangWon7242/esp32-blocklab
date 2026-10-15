bricks = [0, 1, 0, 0]
jump = 0
pressed = True
if jump > 0:
    jump = jump + 1
    if jump > 2:
        jump = 0
if pressed:
    pressed = False
    if jump == 0:
        jump = 1
if bricks[1] == 1 and jump == 0:
    print("GAME OVER")
else:
    print("SAFE")
