problem = [0, 2, 1]
answer = [0, 2, 1]
if len(answer) == len(problem):
    correct = 0
    for i in range(len(problem)):
        if answer[i] == problem[i]:
            correct += 1
    if correct == len(problem):
        print("OK")
    else:
        print("END")
