CFLAGS=-O3 -Wall -Wextra -pedantic
CC=g++

.PHONY: clean jsons

bin/tree: src/tree.cpp
	$(CC) src/tree.cpp $(CFLAGS) -o bin/tree

jsons: clean bin/tree data/draftversion3.tre
	bin/tree < data/draftversion3.tre
	
clean:
	rm -f bin/tree bin/*.o
	rm -f data/subtree*.json
	rm -f data/root.json
