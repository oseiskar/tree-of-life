#include <iostream>
#include <string>
#include <map>
#include <stdexcept>

using std::string;

template <class Value>
struct Trie {
    
    std::map<string, Trie> children;
    Value v;

    void insert(string key, Value v) {
    }
    
    Value *lookup(string key) {
        return NULL;
    }
    
    Value &get(string key) {
        Value *v = lookup(key);
        if (v == NULL)
            throw std::runtime_error("key not found");
        return *v;
    }
};
