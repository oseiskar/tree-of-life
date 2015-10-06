#include <iostream>
#include <string>
#include <map>
#include <stdexcept>

using std::string;

class CharTrie {
public:
    std::map<char, CharTrie> children;

    typedef std::map<char, CharTrie>::iterator iterator;
    typedef std::map<char, CharTrie>::const_iterator const_iterator;

    void insert(const char *key, string value, bool replace = false) {
        CharTrie &where = lookup_subtree(key);
        where.insert_subtree(key, value, replace);
    }
    
    const string *lookup(const char *key) {
        CharTrie &where = lookup_subtree(key);
        if (key[0] != '\0' || !where.has_value) return NULL;
        return &(where.value);
    }
    
    const string &get(const char *key) {
        const string *s = lookup(key);
        if (s == NULL) throw std::runtime_error("not found");
        return *s;
    }
    
    CharTrie() : has_value(false) {}
    
private:
    string value;
    bool has_value;

    CharTrie &lookup_subtree(const char *&key) {
        
        if (key[0] == '\0') return *this;
        iterator itr = children.find(key[0]);
        if (itr != children.end()) {
            key += 1;
            return itr->second.lookup_subtree(key);
        }
        return *this;
    }
    
    void insert_subtree(const char *key, const string &new_v, bool replace) {
        
        if (key[0] == '\0') {
            if (!replace && has_value)
                throw std::runtime_error("key already exists in trie");
            value = new_v;
            has_value = true;
            return;
        }
        
        children[key[0]] = CharTrie();
        children.find(key[0])->second.insert_subtree(key+1, new_v, replace);
    }
};
