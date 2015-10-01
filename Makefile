CFLAGS=-O3 -Wall -Wextra -pedantic
CC=g++

.PHONY: all clean jsons

tree: tree.cpp
	$(CC) tree.cpp $(CFLAGS) -o tree
	
jsons: clean tree data/draftversion3.tre
	./tree < data/draftversion3.tre
	
clean:
	rm -f tree
	rm -f data/subtree*.json
	rm -f data/root.json
