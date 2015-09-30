CFLAGS=-O3 -Wall -Wextra -pedantic
CC=g++

.PHONY: all clean jsons

tree: tree.cpp
	$(CC) tree.cpp $(CFLAGS) -o tree
	
jsons: tree data/draftversion3.tre
	./tree < data/draftversion3.tre > data/out.json
	
clean:
	rm tree
