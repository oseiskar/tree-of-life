#include <iostream>
#include <string>
#include <map>
#include <stdexcept>

class CharTrie {
public:
    std::map<char, CharTrie> children;

    typedef std::map<char, CharTrie>::iterator iterator;
    typedef std::map<char, CharTrie>::const_iterator const_iterator;
    
    CharTrie(const void *v = NULL) : value(v) {}

    void insert(const char *key, const void *v, bool replace = false) {
        CharTrie &where = lookup_subtree(key);
        where.insert_subtree(key, v, replace);
    }
    
    const void *lookup(const char *key) {
        CharTrie &where = lookup_subtree(key);
        if (key[0] != '\0') return NULL;
        return where.value;
    }
    
private:
    const void *value;

    CharTrie &lookup_subtree(const char *&key) {
        
        if (key[0] == '\0') return *this;
        iterator itr = children.find(key[0]);
        if (itr != children.end()) {
            key += 1;
            return itr->second.lookup_subtree(key);
        }
        return *this;
    }
    
    void insert_subtree(const char *key, const void *new_v, bool replace) {
        
        if (key[0] == '\0') {
            if (!replace && value != NULL)
                throw std::runtime_error("key already exists in trie");
            value = new_v;
            return;
        }
        
        children[key[0]] = CharTrie();
        children.find(key[0])->second.insert_subtree(key+1, new_v, replace);
    }
};
